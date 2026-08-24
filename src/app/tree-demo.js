import * as THREE from 'three';
import {
  isWindDisabled,
  TreeWindController,
} from '../animation/tree-wind-controller.js';
import {
  createForestSceneConfig,
  DEFAULT_FOREST_SIZE,
  FOREST_SEED,
  FOREST_SIZES,
  isForestSceneRequested,
} from './forest-scene.js';
import {
  createStressSceneConfig,
  isStressSceneRequested,
} from './stress-scene.js';
import { buildTreeReplacement } from './tree-rebuild-transaction.js';
import { FirstPersonNavigator } from '../controls/first-person-navigator.js';
import { logger } from '../core/logger.js';
import { CanopySolidityProbe } from '../diagnostics/canopy-solidity-probe.js';
import { FrameStatistics } from '../diagnostics/frame-statistics.js';
import {
  reportQaStatus,
  serializeQaError,
} from '../diagnostics/qa-status-reporter.js';
import { RenderSmokeProbe } from '../diagnostics/render-smoke-probe.js';
import { FrameBudgetQueue } from '../generation/frame-budget-queue.js';
import { TreeGenerator } from '../generation/tree-generator.js';
import { analyzeShellCoverage } from '../qa/shell-coverage-analyzer.js';
import { disposeObject } from '../rendering/object-disposer.js';
import { applySceneSettings, SceneFactory } from '../rendering/scene-factory.js';
import { resolveShadowAnchor } from '../rendering/shadow-anchor.js';
import { TreeImpostorRenderer } from '../rendering/tree-impostor-renderer.js';
import { TreeMeshBuilder } from '../rendering/tree-mesh-builder.js';
import { createPostPipeline } from '../rendering/post-pipeline.js';
import { isPostProcessingEnabled } from '../rendering/post-processing-mode.js';
import { resolveFocusDistance } from '../rendering/depth-of-field-math.js';
import { ContactShadowField } from '../rendering/contact-shadow-field.js';
import { MeadowCarpet } from '../rendering/meadow-carpet.js';
import { DEFAULT_MEADOW } from '../rendering/meadow-scatter.js';
import {
  applySeasonToPresets,
  applySeasonToScene,
  requestedSeason,
  resolveSeason,
  SUMMER_SEASON,
} from './season.js';
import { TreeBillboardBatchManager } from '../rendering/tree-billboard-batch-manager.js';
import { TreeLodController } from '../rendering/tree-lod-controller.js';
import { resolveTreeWorldScale } from '../rendering/tree-projection-math.js';
import { measureViewport } from '../rendering/viewport-size.js';
import { createDemoOverlay, showFatalError } from '../ui/demo-overlay.js';

const DEFAULT_COVERAGE_PROBE_OPTIONS = Object.freeze({
  probeDensityMultiplier: 2,
  probeExposureMargin: 0.05,
});
const DEFAULT_STRESS_POLICY = Object.freeze({
  expectedTreeCount: 75,
  maximumColorDrawCalls: 100,
});
const STUDIO_SEED = 411287;
const RESEED_STEP = 1009;

export const GARDEN_SCENE = 'garden';
export const FOREST_SCENE = 'forest';

const INLINE_BUILD_LIMIT = 16;
const SHADOW_ANCHOR_STEP = 6;
const SUN_DISTANCE = 60;
const TRUNK_COLLISION_MARGIN = 1.7;
const STATISTICS_INTERVAL_MS = 240;
const MEADOW_WIND_SEED = 7717;
const MAXIMUM_FRAME_DELTA = 0.1;

function readSearchParameter(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export class TreeDemo {
  constructor({
    sceneFactory = new SceneFactory(),
    treeGenerator = new TreeGenerator(),
    treeMeshBuilder = new TreeMeshBuilder(),
    windController = new TreeWindController({ enabled: !isWindDisabled() }),
    renderSmokeProbe = new RenderSmokeProbe(),
    canopySolidityProbe = new CanopySolidityProbe(),
  } = {}) {
    this.sceneFactory = sceneFactory;
    this.treeGenerator = treeGenerator;
    this.treeMeshBuilder = treeMeshBuilder;
    this.windController = windController;
    this.renderSmokeProbe = renderSmokeProbe;
    this.canopySolidityProbe = canopySolidityProbe;
    this.generationQueue = new FrameBudgetQueue();
    this.treeRoots = [];
    this.seedOffset = 0;
    this.studioLayout = null;
    this.treeDataByPreset = new Map();
    this.clock = new THREE.Clock();
    this.handleResize = this.handleResize.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.render = this.render.bind(this);
    this.stressSamples = [];
    this.stressReported = false;
    this.viewportHeight = 1;
    this.destroyed = true;
    this.sceneId = GARDEN_SCENE;
    this.forestSize = DEFAULT_FOREST_SIZE;
    this.forestSeedOffset = 0;
    this.cameraMode = 'orbit';
    this.treeColliders = [];
    this.frameStatistics = new FrameStatistics();
    this.frameListeners = new Set();
    this.lastStatisticsTime = 0;
    this.elapsedTime = 0;
    this.shadowAnchor = null;
    this.postPipeline = null;
    this.season = SUMMER_SEASON;
  }

  start(
    container,
    sceneConfig,
    library,
    releaseVersion,
    overlayTitle,
    qaSettings = {},
  ) {
    this.container = container;
    this.stressMode = isStressSceneRequested();
    this.baseSceneConfig = sceneConfig;
    this.library = library;
    this.basePresetMap = library.presets;
    this.season = requestedSeason();
    this.presetMap = applySeasonToPresets(this.basePresetMap, this.season);
    this.coverageProbeOptions =
      qaSettings.coverageProbeOptions ?? DEFAULT_COVERAGE_PROBE_OPTIONS;
    this.stressPolicy = qaSettings.stressPolicy ?? DEFAULT_STRESS_POLICY;
    this.forestSize = FOREST_SIZES[readSearchParameter('forest')]
      ? readSearchParameter('forest')
      : DEFAULT_FOREST_SIZE;
    if (!this.stressMode && isForestSceneRequested()) this.sceneId = FOREST_SCENE;
    this.sceneConfig = this.resolveSceneConfig();
    const presetMap = this.presetMap;
    this.viewportHeight = measureViewport(container).height;
    this.context = this.sceneFactory.create(container, this.sceneConfig);
    this.destroyed = false;
    this.sunDirection = this.context.sun.position.clone().normalize();
    this.impostorRenderer = new TreeImpostorRenderer(this.context.renderer);
    this.impostorRenderer.configureLights(
      this.sunDirection,
      this.sceneConfig.lighting,
    );
    this.navigator = new FirstPersonNavigator(
      this.context.camera,
      this.context.renderer.domElement,
      {
        getColliders: () => this.treeColliders,
        getBoundsRadius: () => this.sceneConfig.scene.groundSize * 0.5 - 4,
        getCeiling: () => this.sceneConfig.camera.far * 0.4,
        onChange: () => this.publishFrameStatistics(true),
      },
    );
    this.applyRequestedView();
    this.billboardBatchManager = new TreeBillboardBatchManager(this.context.scene);
    this.rebuildDressing();
    this.lodController = new TreeLodController(
      this.sceneConfig.lod,
      this.generationQueue,
    );
    this.renderSmokeProbe.install(this.context.renderer);

    const labels = [...new Set(this.sceneConfig.layout.map((entry) => {
      const preset = presetMap.get(entry.preset);

      if (!preset) {
        throw new Error(`Layout references unknown tree preset '${entry.preset}'.`);
      }

      return preset.label;
    }))];

    this.canopySolidityProbe.install();
    if (isPostProcessingEnabled()) {
      this.postPipeline = createPostPipeline({
        renderer: this.context.renderer,
        scene: this.context.scene,
        camera: this.context.camera,
        container,
        depthOfField: this.sceneConfig.renderer.depthOfField,
      });
    }
    this.overlay = createDemoOverlay(container, labels, overlayTitle);
    this.rebuildTrees();
    this.applyRequestedCameraMode();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    this.context.renderer.setAnimationLoop(this.render);
    void this.renderSmokeProbe.compile(
      this.context.renderer,
      this.context.scene,
      this.context.camera,
    );
    void this.runCanopySolidityProbe();
    logger.info('Procedural tree demo started.', {
      releaseVersion,
      presets: labels,
      treeCount: this.sceneConfig.layout.length,
      stressMode: this.stressMode,
    });
  }

  get activeLayout() {
    return this.studioLayout ?? this.sceneConfig.layout;
  }

  resolveSceneConfig() {
    return applySeasonToScene(this.resolveSceneLayout(), this.season);
  }

  resolveSceneLayout() {
    if (this.stressMode) return createStressSceneConfig(this.baseSceneConfig);
    if (this.sceneId !== FOREST_SCENE) return this.baseSceneConfig;

    return createForestSceneConfig(this.baseSceneConfig, {
      size: this.forestSize,
      presets: [...this.presetMap.values()].map((preset) => ({
        id: preset.id,
        height: preset.height,
      })),
      seed: FOREST_SEED + this.forestSeedOffset * 7717,
    });
  }

  setSeason(seasonId) {
    const season = resolveSeason(seasonId);
    if (season === this.season) return;

    this.season = season;
    this.presetMap = applySeasonToPresets(this.basePresetMap, season);
    this.applySceneConfig();
  }

  resolveMinimumLod(entry) {
    if (entry.minimumLod !== undefined) return Number(entry.minimumLod);
    if (!this.stressMode) return 0;

    return Number(entry.position[2]) <= -160 ? 3 : 2;
  }

  buildTreeEntry(entry, billboardBatchManager) {
    const preset = this.presetMap.get(entry.preset);
    if (!preset) {
      throw new Error(`Layout references unknown tree preset '${entry.preset}'.`);
    }

    const seed = (Number(entry.seed) + Math.imul(this.seedOffset, RESEED_STEP)) >>> 0;
    const minimumLod = this.resolveMinimumLod(entry);
    const treeData = this.treeGenerator.generate(preset, seed, {
      includeSurfaceSamples: minimumLod < 2,
    });
    const rotationY = Number(entry.rotationY ?? 0);
    const scale = Number(entry.scale ?? 1);
    let tree = null;

    try {
      tree = this.treeMeshBuilder.build(treeData, {
        sunDirection: this.sunDirection.clone(),
        impostorRenderer: this.impostorRenderer,
        impostorRotationY: rotationY,
        deferHero: !this.renderSmokeProbe.enabled,
        minimumLod,
      });
      tree.position.fromArray(entry.position);
      tree.rotation.y = rotationY;
      if (scale !== 1) tree.scale.setScalar(scale);
      tree.updateMatrixWorld(true);
      tree.userData.lod.billboardBatchManager = billboardBatchManager;
      tree.userData.dressing = {
        bounds: treeData.bounds,
        position: entry.position,
        rotationY,
        scale,
        colliderRadius: treeData.trunk.startRadius * scale * TRUNK_COLLISION_MARGIN,
      };
      billboardBatchManager.register(tree);
      return { root: tree, treeData };
    } catch (error) {
      if (tree) disposeObject(tree);
      throw error;
    }
  }

  dressTree(root) {
    const dressing = root.userData.dressing;
    if (!dressing) return;
    this.contactShadows?.add(dressing);
    this.treeColliders.push({
      x: root.position.x,
      z: root.position.z,
      radius: dressing.colliderRadius,
    });
  }

  registerMeadowWind() {
    if (!this.meadow?.mesh) return;
    this.windController.register(this.meadow.mesh, MEADOW_WIND_SEED);
  }

  clearLiveTrees() {
    this.lodController.clear();
    this.windController.clear();
    this.billboardBatchManager.clear();

    for (const root of this.treeRoots) {
      this.context.scene.remove(root);
      disposeObject(root);
    }

    this.treeRoots.length = 0;
    this.treeColliders.length = 0;
    this.treeDataByPreset.clear();
  }

  installTreeReplacement(replacement) {
    this.lodController.clear();
    this.windController.clear();

    const previousBatchManager = this.billboardBatchManager;
    for (const root of this.treeRoots) {
      this.context.scene.remove(root);
      disposeObject(root);
    }
    previousBatchManager.clear();

    this.billboardBatchManager = replacement.billboardBatchManager;
    this.treeRoots.length = 0;
    this.treeRoots.push(...replacement.roots);
    this.treeColliders.length = 0;
    this.treeDataByPreset.clear();
    this.contactShadows?.reset(this.treeRoots.length);

    for (const [presetId, treeData] of replacement.treeDataByPreset) {
      this.treeDataByPreset.set(presetId, treeData);
    }

    this.registerMeadowWind();
    for (const root of this.treeRoots) {
      this.context.scene.add(root);
      this.lodController.register(root);
      this.windController.register(root, root.userData.tree.seed);
      this.dressTree(root);
    }

    this.context.renderer.shadowMap.needsUpdate = true;
  }

  rebuildQueuedTrees() {
    this.clearLiveTrees();
    this.contactShadows?.reset(this.activeLayout.length);
    this.registerMeadowWind();
    const seedOffset = this.seedOffset;

    for (const [index, entry] of this.activeLayout.entries()) {
      this.generationQueue.enqueue(`tree:${seedOffset}:${index}`, () => {
        if (this.destroyed) return;
        const { root, treeData } = this.buildTreeEntry(
          entry,
          this.billboardBatchManager,
        );
        this.context.scene.add(root);
        this.treeRoots.push(root);
        if (this.resolveMinimumLod(entry) === 0) {
          this.treeDataByPreset.set(entry.preset, treeData);
        }
        this.lodController.register(root);
        this.windController.register(root, treeData.seed);
        this.dressTree(root);
        this.context.renderer.shadowMap.needsUpdate = true;
      });
    }
  }

  rebuildTrees() {
    this.generationQueue.clear();

    if (this.stressMode || this.activeLayout.length > INLINE_BUILD_LIMIT) {
      this.rebuildQueuedTrees();
      this.context.renderer.shadowMap.needsUpdate = true;
      return;
    }

    const replacement = buildTreeReplacement(this.activeLayout, {
      createBatchManager: () =>
        new TreeBillboardBatchManager(this.context.scene),
      buildEntry: (entry, billboardBatchManager) =>
        this.buildTreeEntry(entry, billboardBatchManager),
      disposeRoot: (root) => disposeObject(root),
    });

    this.installTreeReplacement(replacement);
  }

  setScene(sceneId) {
    if (this.stressMode || sceneId === this.sceneId) return;

    this.sceneId = sceneId;
    this.applySceneConfig();
  }

  setForestSize(sizeId) {
    if (!FOREST_SIZES[sizeId] || sizeId === this.forestSize) return;

    this.forestSize = sizeId;
    if (this.sceneId === FOREST_SCENE) this.applySceneConfig();
  }

  reseedScene() {
    if (this.sceneId !== FOREST_SCENE) {
      this.reseed();
      return;
    }

    this.forestSeedOffset += 1;
    this.applySceneConfig();
  }

  applySceneConfig() {
    this.studioLayout = null;
    this.studioPresetId = null;
    this.sceneConfig = this.resolveSceneConfig();
    this.shadowAnchor = null;
    applySceneSettings(this.context, this.sceneConfig);
    this.sunDirection = this.context.sun.position.clone().normalize();
    this.impostorRenderer.configureLights(
      this.sunDirection,
      this.sceneConfig.lighting,
    );
    this.lodController.settings = this.sceneConfig.lod;
    this.rebuildDressing();
    this.rebuildTrees();
    this.setCameraMode(this.cameraMode);
  }

  rebuildDressing() {
    this.contactShadows?.disposeShared();
    this.meadow?.disposeShared();
    this.contactShadows = new ContactShadowField(
      this.context.scene,
      this.sceneConfig.scene.contactShadow,
    );
    this.meadow = new MeadowCarpet(
      this.context.scene,
      this.sceneConfig.scene.meadow,
    );
    this.rebuildMeadow();
  }

  rebuildMeadow() {
    const { scene, forest } = this.sceneConfig;
    const configured = scene.meadow?.radius ?? DEFAULT_MEADOW.radius;
    const reach = forest ? forest.clearingRadius + 18 : configured;

    this.meadow.build(Math.min(reach, scene.groundSize * 0.5 - 1));
  }

  setCameraMode(mode) {
    this.cameraMode = mode;

    if (mode !== 'walk' && mode !== 'fly') {
      this.cameraMode = 'orbit';
      this.navigator.exit();
      this.context.controls.enabled = true;
      this.aimOrbitAtView();
      return;
    }

    this.context.controls.enabled = false;
    this.navigator.enter(mode);
  }

  aimOrbitAtView() {
    const { camera, controls } = this.context;
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const distance = THREE.MathUtils.clamp(controls.minDistance * 1.7, 8, 24);
    const target = camera.position.clone().addScaledVector(direction, distance);

    controls.target.set(target.x, Math.max(1.4, target.y), target.z);
    controls.update();
  }

  addFrameListener(listener) {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  reseed() {
    const previousSeedOffset = this.seedOffset;
    this.seedOffset += 1;

    try {
      this.rebuildTrees();
    } catch (error) {
      this.seedOffset = previousSeedOffset;
      throw error;
    }
  }

  setStudioPreset(presetId) {
    if (this.stressMode) return;

    const previousPresetId = this.studioPresetId;
    const previousLayout = this.studioLayout;
    this.studioPresetId = presetId ?? null;
    this.studioLayout = presetId
      ? [
          {
            preset: presetId,
            seed: STUDIO_SEED,
            position: [0, 0, 0],
            rotationY: 0,
          },
        ]
      : null;

    try {
      this.rebuildTrees();
    } catch (error) {
      this.studioPresetId = previousPresetId;
      this.studioLayout = previousLayout;
      throw error;
    }

    if (presetId) this.frameStudioTree(presetId);
  }

  rebuildPreset(presetId) {
    if (this.studioPresetId && this.studioPresetId !== presetId) {
      this.setStudioPreset(presetId);
      return;
    }

    this.rebuildTrees();
  }

  analyzeCoverage(presetId) {
    const preset = this.presetMap.get(presetId);
    const treeData = this.treeDataByPreset.get(presetId);

    if (!preset || !treeData || treeData.shell.length === 0) return null;

    return analyzeShellCoverage(treeData, preset, this.coverageProbeOptions);
  }

  frameStudioTree(presetId = this.studioPresetId) {
    const root =
      this.treeRoots.find((tree) => tree.userData.tree.presetId === presetId) ??
      this.treeRoots.at(-1);

    if (!root) return;

    const height =
      root.userData.tree.height *
      resolveTreeWorldScale(root.getWorldScale(new THREE.Vector3()));
    const { camera, controls } = this.context;
    controls.target.set(root.position.x, height * 0.52, root.position.z);
    camera.position.set(
      root.position.x + height * 1.05,
      height * 0.82,
      root.position.z + height * 1.3,
    );
    camera.updateProjectionMatrix();
    controls.update();
  }

  async runCanopySolidityProbe() {
    if (!this.canopySolidityProbe.enabled) return;

    do {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (this.destroyed || !this.context) return;
    } while (this.generationQueue.length > 0);

    await this.canopySolidityProbe.run({
      renderer: this.context.renderer,
      scene: this.context.scene,
      trees: this.treeRoots,
    });
  }

  handleResize() {
    if (this.destroyed || !this.context) return;
    const { camera, renderer } = this.context;
    const { width, height } = measureViewport(this.container);
    this.viewportHeight = height;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    this.postPipeline?.setSize(width, height);
  }

  handleKeyDown(event) {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('.tuning-panel, .scene-menu')
    ) {
      return;
    }

    if (event.key.toLowerCase() === 'r' && !event.repeat) {
      try {
        this.reseedScene();
      } catch (error) {
        logger.error('Failed to reseed the tree scene.', error);
      }
    }
  }

  handleRuntimeError(error) {
    if (this.destroyed) return;

    const container = this.container;
    const message = serializeQaError(error);
    logger.error('Procedural tree render loop failed.', error);
    this.renderSmokeProbe.fail(error);
    reportQaStatus('error', message);

    try {
      this.destroy();
    } catch (cleanupError) {
      logger.error('Failed to clean up after a render loop error.', cleanupError);
    }

    if (container) showFatalError(container, error);
  }

  render() {
    if (this.destroyed || !this.context) return;

    try {
      const delta = Math.min(this.clock.getDelta(), MAXIMUM_FRAME_DELTA);
      this.elapsedTime += delta;
      this.generationQueue.process(this.sceneConfig.lod.generationBudgetMs);
      this.windController.update(this.elapsedTime);
      if (this.navigator?.active) {
        this.navigator.update(delta);
      } else {
        this.context.controls.update();
      }
      this.updateSunAnchor();
      this.lodController.update(
        this.context.camera,
        this.viewportHeight,
        this.context.renderer,
      );
      if (this.postPipeline) {
        this.updateFocusDistance();
        this.postPipeline.render();
      } else {
        this.context.renderer.render(this.context.scene, this.context.camera);
      }
      this.publishFrameStatistics();
      this.updateStressReport();
    } catch (error) {
      this.handleRuntimeError(error);
    }
  }

  updateFocusDistance() {
    this.postPipeline.setFocusDistance(
      resolveFocusDistance(
        {
          cameraPosition: this.context.camera.position,
          target: this.context.controls.target,
          walking: Boolean(this.navigator?.active),
        },
        this.postPipeline.focusSettings,
      ),
    );
  }

  updateSunAnchor() {
    if (!this.sceneConfig.lighting.followFocus) return;

    const focus = this.navigator.active
      ? this.context.camera.position
      : this.context.controls.target;
    const { anchor, moved } = resolveShadowAnchor(
      this.shadowAnchor,
      focus,
      SHADOW_ANCHOR_STEP,
    );

    if (!moved) return;

    this.shadowAnchor = anchor;
    const { sun } = this.context;
    sun.target.position.set(anchor.x, 0, anchor.z);
    sun.target.updateMatrixWorld();
    sun.position
      .copy(this.sunDirection)
      .multiplyScalar(SUN_DISTANCE)
      .add(sun.target.position);
    this.context.renderer.shadowMap.needsUpdate = true;
  }

  publishFrameStatistics(force = false) {
    const now = performance.now();

    if (!force) this.frameStatistics.sample(now);
    if (this.frameListeners.size === 0) return;
    if (!force && now - this.lastStatisticsTime < STATISTICS_INTERVAL_MS) return;

    this.lastStatisticsTime = now;
    const sample = this.createStatisticsSample();
    for (const listener of this.frameListeners) listener(sample);
  }

  createStatisticsSample() {
    const { info } = this.context.renderer;

    return {
      fps: this.frameStatistics.fps,
      frameMs: this.frameStatistics.frameMs,
      worstFrameMs: this.frameStatistics.worstFrameMs,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      lod: this.lodController.summarize(),
      built: this.treeRoots.length,
      total: this.activeLayout.length,
      pending: this.generationQueue.length,
      sceneId: this.sceneId,
      cameraMode: this.cameraMode,
      pointerLocked: this.navigator.locked,
    };
  }

  applyRequestedView() {
    if (readSearchParameter('view') !== 'close') return;

    this.context.camera.position.set(13, 6.3, 9.2);
    this.context.controls.target.set(5.4, 4.2, 0.5);
    this.context.camera.updateProjectionMatrix();
    this.context.controls.update();
  }

  applyRequestedCameraMode() {
    const mode = readSearchParameter('camera');
    if (mode === 'walk' || mode === 'fly') this.setCameraMode(mode);
  }

  updateStressReport() {
    if (
      !this.stressMode ||
      this.stressReported ||
      this.generationQueue.length > 0 ||
      this.treeRoots.length !== this.sceneConfig.layout.length
    ) {
      return;
    }
    this.stressSamples.push({
      time: performance.now(),
      drawCalls: this.context.renderer.info.render.calls,
      triangles: this.context.renderer.info.render.triangles,
    });
    if (this.stressSamples.length < 10) return;
    const first = this.stressSamples[0];
    const last = this.stressSamples.at(-1);
    const fps = ((this.stressSamples.length - 1) * 1000) / (last.time - first.time);
    const maximumDrawCalls = Math.max(
      ...this.stressSamples.map((sample) => sample.drawCalls),
    );
    const maximumTriangles = Math.max(
      ...this.stressSamples.map((sample) => sample.triangles),
    );
    const expectedTreeCount = this.stressPolicy.expectedTreeCount;
    const maximumColorDrawCalls = this.stressPolicy.maximumColorDrawCalls;
    const treeCountMatches = this.treeRoots.length === expectedTreeCount;
    const drawCallsPass = maximumDrawCalls <= maximumColorDrawCalls;
    const passed = treeCountMatches && drawCallsPass;
    const root = document.documentElement;
    root.dataset.stressStatus = passed ? 'ready' : 'error';
    root.dataset.stressTreeCount = String(this.treeRoots.length);
    root.dataset.stressFps = fps.toFixed(1);
    root.dataset.stressDrawCalls = String(maximumDrawCalls);
    root.dataset.stressTriangles = String(maximumTriangles);
    root.dataset.stressGenerationMaxMs =
      this.generationQueue.maximumTaskDuration.toFixed(2);
    this.stressReported = true;
    const query = new URLSearchParams({
      status: root.dataset.stressStatus,
      error: passed
        ? ''
        : !treeCountMatches
          ? `Stress tree count ${this.treeRoots.length} did not match ${expectedTreeCount}.`
          : `Stress draw calls ${maximumDrawCalls} exceeded ${maximumColorDrawCalls}.`,
    });
    void fetch(`/__render-smoke-status?${query}`, {
      cache: 'no-store',
      keepalive: true,
    }).catch(() => {});
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.navigator?.dispose();
    this.frameListeners.clear();
    const context = this.context;
    context?.renderer.setAnimationLoop(null);
    this.generationQueue.clear();
    this.lodController?.clear();
    this.windController.clear();
    this.billboardBatchManager?.clear();

    for (const root of this.treeRoots) {
      context?.scene.remove(root);
      disposeObject(root);
    }
    this.treeRoots.length = 0;
    this.treeColliders.length = 0;
    this.treeDataByPreset.clear();

    if (context?.ground) {
      context.scene.remove(context.ground);
      disposeObject(context.ground);
    }

    this.impostorRenderer?.dispose();
    this.contactShadows?.disposeShared();
    this.meadow?.disposeShared();
    this.postPipeline?.dispose();
    context?.controls.dispose();
    context?.renderer.dispose();
    context?.renderer.domElement?.remove?.();
    this.overlay?.remove();

    this.context = null;
    this.container = null;
    this.impostorRenderer = null;
    this.billboardBatchManager = null;
    this.lodController = null;
    this.overlay = null;
    this.postPipeline = null;
    this.library = null;
    this.presetMap = null;
    this.sceneConfig = null;
    this.coverageProbeOptions = null;
    this.stressPolicy = null;
    this.studioLayout = null;
    this.studioPresetId = null;
    this.viewportHeight = 1;
  }
}
