import * as THREE from 'three';
import { TreeWindController } from '../animation/tree-wind-controller.js';
import {
  createStressSceneConfig,
  isStressSceneRequested,
} from './stress-scene.js';
import { buildTreeReplacement } from './tree-rebuild-transaction.js';
import { logger } from '../core/logger.js';
import { CanopySolidityProbe } from '../diagnostics/canopy-solidity-probe.js';
import {
  reportQaStatus,
  serializeQaError,
} from '../diagnostics/qa-status-reporter.js';
import { RenderSmokeProbe } from '../diagnostics/render-smoke-probe.js';
import { FrameBudgetQueue } from '../generation/frame-budget-queue.js';
import { TreeGenerator } from '../generation/tree-generator.js';
import { analyzeShellCoverage } from '../qa/shell-coverage-analyzer.js';
import { disposeObject } from '../rendering/object-disposer.js';
import { SceneFactory } from '../rendering/scene-factory.js';
import { TreeImpostorRenderer } from '../rendering/tree-impostor-renderer.js';
import { TreeMeshBuilder } from '../rendering/tree-mesh-builder.js';
import { TreeBillboardBatchManager } from '../rendering/tree-billboard-batch-manager.js';
import { TreeLodController } from '../rendering/tree-lod-controller.js';
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

export class TreeDemo {
  constructor({
    sceneFactory = new SceneFactory(),
    treeGenerator = new TreeGenerator(),
    treeMeshBuilder = new TreeMeshBuilder(),
    windController = new TreeWindController(),
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
    // Advanced only when a new tree is asked for, so tuning a preset re-renders
    // the same tree instead of rolling a different one on every edit.
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
    this.sceneConfig = this.stressMode
      ? createStressSceneConfig(sceneConfig)
      : sceneConfig;
    this.library = library;
    this.presetMap = library.presets;
    this.coverageProbeOptions =
      qaSettings.coverageProbeOptions ?? DEFAULT_COVERAGE_PROBE_OPTIONS;
    this.stressPolicy = qaSettings.stressPolicy ?? DEFAULT_STRESS_POLICY;
    const presetMap = this.presetMap;
    this.viewportHeight = measureViewport(container).height;
    this.context = this.sceneFactory.create(container, this.sceneConfig);
    this.destroyed = false;
    // Impostors are captured from the level they replace, which needs the live
    // renderer and the same lights the scene is drawn with.
    this.impostorRenderer = new TreeImpostorRenderer(this.context.renderer);
    this.impostorRenderer.configureLights(
      this.context.sun.position.clone().normalize(),
      this.sceneConfig.lighting,
    );
    this.applyRequestedView();
    this.billboardBatchManager = new TreeBillboardBatchManager(this.context.scene);
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
    this.overlay = createDemoOverlay(container, labels, overlayTitle);
    this.rebuildTrees();
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

  buildTreeEntry(entry, billboardBatchManager) {
    const preset = this.presetMap.get(entry.preset);
    if (!preset) {
      throw new Error(`Layout references unknown tree preset '${entry.preset}'.`);
    }

    const seed = (Number(entry.seed) + Math.imul(this.seedOffset, RESEED_STEP)) >>> 0;
    const treeData = this.treeGenerator.generate(preset, seed, {
      includeSurfaceSamples: !this.stressMode,
    });
    let tree = null;

    try {
      tree = this.treeMeshBuilder.build(treeData, {
        sunDirection: this.context.sun.position.clone().normalize(),
        impostorRenderer: this.impostorRenderer,
        deferHero: !this.renderSmokeProbe.enabled,
        minimumLod:
          this.stressMode && Number(entry.position[2]) <= -160 ? 3 :
            this.stressMode ? 2 : 0,
      });
      tree.position.fromArray(entry.position);
      tree.rotation.y = Number(entry.rotationY ?? 0);
      tree.updateMatrixWorld(true);
      tree.userData.lod.billboardBatchManager = billboardBatchManager;
      billboardBatchManager.register(tree);
      return { root: tree, treeData };
    } catch (error) {
      if (tree) disposeObject(tree);
      throw error;
    }
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
    this.treeDataByPreset.clear();

    for (const [presetId, treeData] of replacement.treeDataByPreset) {
      this.treeDataByPreset.set(presetId, treeData);
    }

    for (const root of this.treeRoots) {
      this.context.scene.add(root);
      this.lodController.register(root);
      this.windController.register(root, root.userData.tree.seed);
    }

    this.context.renderer.shadowMap.needsUpdate = true;
  }

  rebuildStressTrees() {
    this.clearLiveTrees();
    const seedOffset = this.seedOffset;

    for (const [index, entry] of this.activeLayout.entries()) {
      this.generationQueue.enqueue(`tree:${seedOffset}:${index}`, () => {
        const { root, treeData } = this.buildTreeEntry(
          entry,
          this.billboardBatchManager,
        );
        this.context.scene.add(root);
        this.treeRoots.push(root);
        this.treeDataByPreset.set(entry.preset, treeData);
        this.lodController.register(root);
        this.windController.register(root, treeData.seed);
        this.context.renderer.shadowMap.needsUpdate = true;
      });
    }
  }

  rebuildTrees() {
    this.generationQueue.clear();

    if (this.stressMode) {
      this.rebuildStressTrees();
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

  /** A fresh set of trees from the same presets. */
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

  /**
   * Shows one tree of a single preset, or the whole scene when cleared.
   *
   * Generating the full layout takes seconds, which is far too slow to sit
   * behind a slider. Editing one tree at a time keeps a rebuild to a few hundred
   * milliseconds, and it is the view you want while shaping a trunk anyway.
   */
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

  /** The coverage the gate would report for the tree currently on screen. */
  analyzeCoverage(presetId) {
    const preset = this.presetMap.get(presetId);
    const treeData = this.treeDataByPreset.get(presetId);

    if (!preset || !treeData || treeData.shell.length === 0) return null;

    return analyzeShellCoverage(treeData, preset, this.coverageProbeOptions);
  }

  /** Points the camera at a tree of the given preset, or at the studio tree. */
  frameStudioTree(presetId = this.studioPresetId) {
    const root =
      this.treeRoots.find((tree) => tree.userData.tree.presetId === presetId) ??
      this.treeRoots.at(-1);

    if (!root) return;

    const height = root.userData.tree.height;
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

    // One presented frame guarantees every hero material has compiled before the
    // probe reads pixels back from its own render target.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (this.destroyed || !this.context) return;

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
  }

  handleKeyDown(event) {
    // The studio panel has text and number fields; an 'r' typed into one of
    // them is a character, not a request for a new tree.
    if (event.target instanceof HTMLElement && event.target.closest('.tuning-panel')) {
      return;
    }

    if (event.key.toLowerCase() === 'r' && !event.repeat) {
      try {
        this.reseed();
      } catch (error) {
        logger.error('Failed to generate a new tree seed.', error);
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
      const elapsed = this.clock.getElapsedTime();
      this.generationQueue.process(this.sceneConfig.lod.generationBudgetMs);
      this.windController.update(elapsed);
      this.context.controls.update();
      this.lodController.update(
        this.context.camera,
        this.viewportHeight,
        this.context.renderer,
      );
      this.context.renderer.render(this.context.scene, this.context.camera);
      this.updateStressReport();
    } catch (error) {
      this.handleRuntimeError(error);
    }
  }

  applyRequestedView() {
    const view = new URLSearchParams(window.location.search).get('view');
    if (view !== 'close') return;

    this.context.camera.position.set(13, 6.3, 9.2);
    this.context.controls.target.set(5.4, 4.2, 0.5);
    this.context.camera.updateProjectionMatrix();
    this.context.controls.update();
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
    this.treeDataByPreset.clear();

    if (context?.ground) {
      context.scene.remove(context.ground);
      disposeObject(context.ground);
    }

    this.impostorRenderer?.dispose();
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
