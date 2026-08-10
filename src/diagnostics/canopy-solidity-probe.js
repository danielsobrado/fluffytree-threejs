import * as THREE from 'three';
import { logger } from '../core/logger.js';
import { CANOPY_SOLIDITY_CONSTANTS } from './canopy-solidity-constants.js';
import {
  postQaReport,
  reportQaStatus,
  serializeQaError,
} from './qa-status-reporter.js';
import {
  evaluateSolidityReport,
  summarizeViewMetrics,
} from '../qa/canopy-solidity-gate.js';
import { CANOPY_SOLIDITY_LOD_STATES } from '../qa/canopy-solidity-lod-states.js';
import { calculateTransitionHoleThresholds } from '../qa/canopy-solidity-scale.js';
import {
  analyzeSilhouetteHoles,
  createAlphaMask,
} from '../qa/silhouette-hole-analyzer.js';
import { YamlConfigLoader } from '../config/yaml-config-loader.js';
import { createSolidityViewImage } from './solidity-view-image.js';
import { setObjectLodFade } from '../rendering/lod-dither-fade.js';

const STATUS_ATTRIBUTE = 'solidityStatus';
const THRESHOLD_URL = './config/canopy-solidity-qa.yaml';
const SCENE_CONFIG_URL = './config/scene.yaml';
const BASELINE_LOD_STATE = 'lod0';

function isSolidityRequested() {
  return (
    new URLSearchParams(window.location.search).get('qa') ===
    CANOPY_SOLIDITY_CONSTANTS.queryValue
  );
}

function createViewDefinitions() {
  const views = [];

  for (const elevation of CANOPY_SOLIDITY_CONSTANTS.crownElevations) {
    for (let index = 0; index < CANOPY_SOLIDITY_CONSTANTS.crownYawCount; index += 1) {
      const yaw =
        CANOPY_SOLIDITY_CONSTANTS.crownYawOffset +
        (index * 360) / CANOPY_SOLIDITY_CONSTANTS.crownYawCount;
      views.push({ group: 'crown', name: `y${Math.round(yaw)}e${elevation}`, yaw, elevation });
    }
  }

  for (const elevation of CANOPY_SOLIDITY_CONSTANTS.baseElevations) {
    for (let index = 0; index < CANOPY_SOLIDITY_CONSTANTS.baseYawCount; index += 1) {
      const yaw =
        CANOPY_SOLIDITY_CONSTANTS.baseYawOffset +
        (index * 360) / CANOPY_SOLIDITY_CONSTANTS.baseYawCount;
      views.push({ group: 'base', name: `y${Math.round(yaw)}e${elevation}`, yaw, elevation });
    }
  }

  return views;
}

function findStructure(tree) {
  let structure = null;
  tree.traverse((object) => {
    if (!structure && object.userData?.structure?.rootBase) structure = object;
  });
  return structure;
}

function createCrownFrame(level) {
  const box = new THREE.Box3().setFromObject(level);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  return { center: sphere.center, radius: sphere.radius };
}

function createBaseFrame(tree, structure) {
  const rootBase = structure.userData.structure.rootBase;
  const flareHeight = Math.min(
    structure.userData.structure.rootFlareHeight,
    structure.userData.structure.lowestBranchHeight ?? Number.POSITIVE_INFINITY,
  );
  const flareSpan = flareHeight - rootBase.y;
  const radius = Math.max(
    rootBase.radius * CANOPY_SOLIDITY_CONSTANTS.baseRadiusMultiplier,
    flareSpan * CANOPY_SOLIDITY_CONSTANTS.baseHeightMultiplier * 0.5,
  );
  const center = new THREE.Vector3(
    rootBase.x,
    (rootBase.y + flareHeight) * 0.5,
    rootBase.z,
  );
  tree.localToWorld(center);
  return { center, radius };
}

function isWorseView(candidate, current) {
  if (!current) return true;
  if (candidate.holeRatio !== current.holeRatio) {
    return candidate.holeRatio > current.holeRatio;
  }
  return candidate.coverageRetention < current.coverageRetention;
}

export class CanopySolidityProbe {
  constructor({
    root = document.documentElement,
    configLoader = new YamlConfigLoader(),
  } = {}) {
    this.root = root;
    this.configLoader = configLoader;
    this.enabled = isSolidityRequested();
    this.views = createViewDefinitions();
    this.lodStates = CANOPY_SOLIDITY_LOD_STATES;
  }

  install() {
    if (!this.enabled) return;
    this.root.dataset[STATUS_ATTRIBUTE] = 'pending';
  }

  async run({ renderer, scene, trees }) {
    if (!this.enabled) return null;

    try {
      const [{ thresholds }, { lod: lodSettings }] = await Promise.all([
        this.configLoader.load(THRESHOLD_URL),
        this.configLoader.load(SCENE_CONFIG_URL),
      ]);

      if (!thresholds) {
        throw new Error('The canopy solidity configuration has no thresholds.');
      }
      if (!lodSettings) {
        throw new Error('The scene configuration has no LOD settings.');
      }

      const report = this.measure({ renderer, scene, trees, lodSettings });
      const failures = evaluateSolidityReport(report.trees, thresholds);
      const passed = failures.length === 0;
      report.passed = passed;
      report.failures = failures;

      this.root.dataset[STATUS_ATTRIBUTE] = passed ? 'ready' : 'error';
      this.root.dataset.solidityTreeCount = String(report.trees.length);
      this.root.dataset.solidityViewCount = String(
        report.trees.reduce((total, tree) => total + tree.views.length, 0),
      );
      this.root.dataset.solidityLodStateCount = String(this.lodStates.length);
      await postQaReport('canopy-solidity', report);
      reportQaStatus(
        passed ? 'ready' : 'error',
        passed ? '' : failures.slice(0, 6).join(' | '),
      );
      return report;
    } catch (error) {
      this.root.dataset[STATUS_ATTRIBUTE] = 'error';
      this.root.dataset.solidityError = serializeQaError(error);
      reportQaStatus('error', serializeQaError(error));
      logger.error('Canopy solidity probe failed.', error);
      return null;
    }
  }

  measure({ renderer, scene, trees, lodSettings }) {
    const resolution = CANOPY_SOLIDITY_CONSTANTS.resolution;
    const target = new THREE.WebGLRenderTarget(resolution, resolution);
    const pixels = new Uint8Array(resolution * resolution * 4);
    const restore = this.beginIsolation(renderer, scene);
    const results = [];

    try {
      for (const tree of trees) {
        results.push(
          this.measureTree({
            renderer,
            scene,
            tree,
            target,
            pixels,
            resolution,
            lodSettings,
          }),
        );
      }
    } finally {
      restore();
      target.dispose();
    }

    return {
      resolution,
      minimumHolePixels: CANOPY_SOLIDITY_CONSTANTS.minimumHolePixels,
      minimumHoleRadius: CANOPY_SOLIDITY_CONSTANTS.minimumHoleRadius,
      lodStates: this.lodStates.map((state) => state.id),
      trees: results,
    };
  }

  beginIsolation(renderer, scene) {
    const previousBackground = scene.background;
    const previousFog = scene.fog;
    const previousClearColor = renderer.getClearColor(new THREE.Color());
    const previousClearAlpha = renderer.getClearAlpha();
    const hidden = [];

    scene.background = null;
    scene.fog = null;
    renderer.setClearColor(0x000000, 0);

    for (const child of scene.children) {
      if (child.isLight) continue;
      if (child.visible) {
        hidden.push(child);
        child.visible = false;
      }
    }

    return () => {
      scene.background = previousBackground;
      scene.fog = previousFog;
      renderer.setClearColor(previousClearColor, previousClearAlpha);
      renderer.setRenderTarget(null);
      for (const child of hidden) child.visible = true;
    };
  }

  measureTree({ renderer, scene, tree, target, pixels, resolution, lodSettings }) {
    const lodState = tree.userData.lod;
    lodState.buildHero?.();
    const heroLevel = lodState.levels[0];
    const structure = findStructure(heroLevel);

    if (!structure) {
      throw new Error('The hero level does not contain a trunk structure.');
    }

    const restoreTree = this.isolateTree(tree, lodState);
    const camera = new THREE.PerspectiveCamera(
      CANOPY_SOLIDITY_CONSTANTS.fieldOfView,
      1,
      0.05,
      400,
    );
    const frames = {
      crown: createCrownFrame(heroLevel),
      base: createBaseFrame(tree, structure),
    };
    const crownViews = this.views.filter((view) => view.group === 'crown');
    const baseViews = this.views.filter((view) => view.group === 'base');
    const views = [];
    const baselineCoverage = new Map();
    const holeMask = new Uint8Array(resolution * resolution);
    const focalPixels =
      resolution /
      (2 * Math.tan(THREE.MathUtils.degToRad(CANOPY_SOLIDITY_CONSTANTS.fieldOfView) * 0.5));
    let worst = null;
    let windMovedRatio = 0;

    const captureView = (view, state) => {
      const distance = this.placeCamera(camera, frames[view.group], view);
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, resolution, resolution, pixels);
      const mask = createAlphaMask(
        pixels,
        resolution,
        resolution,
        CANOPY_SOLIDITY_CONSTANTS.alphaThreshold,
      );
      const probeProjectedPixels =
        (tree.userData.tree.height / Math.max(0.001, distance)) * focalPixels;
      const targetProjectedPixels = state.projectedPixelsKey
        ? lodSettings[state.projectedPixelsKey]
        : probeProjectedPixels;
      const holeThresholds = calculateTransitionHoleThresholds({
        minimumHolePixels: CANOPY_SOLIDITY_CONSTANTS.minimumHolePixels,
        minimumHoleRadius: CANOPY_SOLIDITY_CONSTANTS.minimumHoleRadius,
        probeProjectedPixels,
        targetProjectedPixels,
      });
      holeMask.fill(0);
      const metrics = analyzeSilhouetteHoles(mask, resolution, resolution, {
        minimumHolePixels: holeThresholds.minimumHolePixels,
        minimumHoleRadius: holeThresholds.minimumHoleRadius,
        holeMask,
      });
      if (state.id === BASELINE_LOD_STATE && view.group === 'crown') {
        baselineCoverage.set(view.name, metrics.coverageRatio);
      }
      const baseline = baselineCoverage.get(view.name) ?? metrics.coverageRatio;
      const coverageRetention =
        baseline <= Number.EPSILON ? 0 : metrics.coverageRatio / baseline;
      const record = {
        ...view,
        lodState: state.id,
        lodKind: state.kind,
        coverageRetention,
        probeProjectedPixels,
        targetProjectedPixels,
        holeVisibilityScale: holeThresholds.scale,
        effectiveMinimumHolePixels: holeThresholds.minimumHolePixels,
        effectiveMinimumHoleRadius: holeThresholds.minimumHoleRadius,
        ...metrics,
      };
      views.push(record);

      if (isWorseView(record, worst)) {
        worst = {
          holeRatio: record.holeRatio,
          coverageRetention: record.coverageRetention,
          name: `${view.group}-${state.id}-${view.name}`,
          image: createSolidityViewImage(
            pixels,
            holeMask,
            resolution,
            resolution,
          ),
        };
      }
    };

    try {
      for (const state of this.lodStates) {
        this.applyLodState(lodState, state);
        this.setFoliageVisible(heroLevel, true);
        for (const view of crownViews) captureView(view, state);
      }

      const baselineState = this.lodStates.find(
        (state) => state.id === BASELINE_LOD_STATE,
      );
      this.applyLodState(lodState, baselineState);
      this.setFoliageVisible(heroLevel, false);
      for (const view of baseViews) captureView(view, baselineState);

      this.setFoliageVisible(heroLevel, true);
      windMovedRatio = this.measureWind({
        renderer,
        scene,
        camera,
        frame: frames.crown,
        view: crownViews[0],
        target,
        pixels,
        resolution,
        tree,
      });
    } finally {
      this.setFoliageVisible(heroLevel, true);
      restoreTree();
    }

    const crownStateSummaries = Object.fromEntries(
      this.lodStates.map((state) => [
        state.id,
        summarizeViewMetrics(
          views.filter(
            (view) => view.group === 'crown' && view.lodState === state.id,
          ),
        ),
      ]),
    );

    return {
      windMovedRatio,
      presetId: tree.userData.tree.presetId,
      seed: tree.userData.tree.seed,
      trunkClosed: structure.userData.structure.trunkClosed === true,
      trunkOutwardFacing:
        structure.userData.structure.trunkOutwardFacing === true,
      trunkBoundaryEdges: structure.userData.structure.trunkBoundaryEdges,
      rootBaseMaximumHeight: structure.userData.structure.rootBaseMaximumHeight,
      summary: summarizeViewMetrics(views),
      crownStateSummaries,
      worstView: worst ? { name: worst.name, image: worst.image } : null,
      views,
    };
  }

  applyLodState(lodState, state) {
    if (!state) throw new Error('A canopy solidity LOD state is required.');

    for (const assignment of state.assignments) {
      if (
        assignment.index === 3 &&
        lodState.billboardBatch &&
        lodState.billboardBatchManager
      ) {
        setObjectLodFade(lodState.levels[3], 0);
        lodState.billboardBatchManager.setFade(
          lodState.billboardBatch,
          assignment.fade,
          assignment.invert,
        );
        continue;
      }

      setObjectLodFade(
        lodState.levels[assignment.index],
        assignment.fade,
        assignment.invert,
      );
    }
  }

  measureWind({ renderer, scene, camera, frame, view, target, pixels, resolution, tree }) {
    const states = [];
    tree.traverse((object) => {
      const materials = Array.isArray(object.material)
        ? object.material
        : object.material
          ? [object.material]
          : [];
      for (const material of materials) {
        const state = material.userData.windState;
        if (state && !states.includes(state)) states.push(state);
      }
    });

    if (states.length === 0) return 0;

    this.placeCamera(camera, frame, view);
    const capture = (time) => {
      for (const state of states) state.time = time;
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, resolution, resolution, pixels);
      return pixels.slice();
    };

    const first = capture(0);
    const second = capture(CANOPY_SOLIDITY_CONSTANTS.windSamplePhase);
    let canopyPixels = 0;
    let movedPixels = 0;

    for (let index = 0; index < resolution * resolution; index += 1) {
      const offset = index * 4;
      if (first[offset + 3] <= CANOPY_SOLIDITY_CONSTANTS.alphaThreshold) continue;

      canopyPixels += 1;
      const difference =
        Math.abs(first[offset] - second[offset]) +
        Math.abs(first[offset + 1] - second[offset + 1]) +
        Math.abs(first[offset + 2] - second[offset + 2]) +
        Math.abs(first[offset + 3] - second[offset + 3]);
      if (difference > CANOPY_SOLIDITY_CONSTANTS.windPixelDifference) movedPixels += 1;
    }

    return canopyPixels === 0 ? 0 : movedPixels / canopyPixels;
  }

  setFoliageVisible(level, visible) {
    for (const child of level.children) {
      if (child.userData?.structure) continue;
      child.visible = visible;
    }
  }

  isolateBillboard(lodState) {
    const manager = lodState.billboardBatchManager;
    const currentHandle = lodState.billboardBatch;

    if (!manager || !currentHandle) return () => {};

    const snapshots = currentHandle.batch.state.entries
      .map((entry) => entry.userData.lod.billboardBatch)
      .filter(Boolean)
      .map((handle) => ({
        handle,
        fade: handle.batch.state.fades[handle.index],
        invert: handle.batch.state.inverted[handle.index] === 1,
      }));

    for (const snapshot of snapshots) {
      manager.setFade(snapshot.handle, 0, false);
    }

    return () => {
      for (const snapshot of snapshots) {
        manager.setFade(snapshot.handle, snapshot.fade, snapshot.invert);
      }
    };
  }

  isolateTree(tree, lodState) {
    const previousTreeVisible = tree.visible;
    const previousProxyVisible = lodState.shadowProxy.visible;
    const previousWind = [];
    const restoreBillboard = this.isolateBillboard(lodState);

    tree.visible = true;
    lodState.shadowProxy.visible = false;
    tree.traverse((object) => {
      const materials = Array.isArray(object.material)
        ? object.material
        : object.material
          ? [object.material]
          : [];
      for (const material of materials) {
        const state = material.userData.windState;
        if (!state || previousWind.some((entry) => entry.state === state)) continue;
        previousWind.push({ state, time: state.time });
        state.time = 0;
      }
    });

    return () => {
      restoreBillboard();
      tree.visible = previousTreeVisible;
      lodState.shadowProxy.visible = previousProxyVisible;
      for (const entry of previousWind) entry.state.time = entry.time;
    };
  }

  placeCamera(camera, frame, view) {
    const distance =
      (frame.radius * CANOPY_SOLIDITY_CONSTANTS.frameMargin) /
      Math.sin(THREE.MathUtils.degToRad(CANOPY_SOLIDITY_CONSTANTS.fieldOfView) * 0.5);
    const phi = THREE.MathUtils.degToRad(90 - view.elevation);
    const theta = THREE.MathUtils.degToRad(view.yaw);

    camera.position.setFromSphericalCoords(distance, phi, theta).add(frame.center);
    camera.lookAt(frame.center);
    camera.near = Math.max(0.05, distance - frame.radius * 2);
    camera.far = distance + frame.radius * 4;
    camera.updateProjectionMatrix();
    return distance;
  }
}
