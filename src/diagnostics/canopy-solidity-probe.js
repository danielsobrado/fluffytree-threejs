import * as THREE from 'three';
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
import {
  analyzeSilhouetteHoles,
  createAlphaMask,
} from '../qa/silhouette-hole-analyzer.js';
import { YamlConfigLoader } from '../config/yaml-config-loader.js';
import { createSolidityViewImage } from './solidity-view-image.js';
import { setObjectLodFade } from '../rendering/lod-dither-fade.js';

const STATUS_ATTRIBUTE = 'solidityStatus';
const THRESHOLD_URL = './config/canopy-solidity-qa.yaml';

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
  // The base group judges the trunk sweep, so the frame stops below the first
  // branch. On a bush the branches start inside the flare band, and a frame that
  // reached them would score the daylight between limbs as a trunk defect.
  const flareHeight = Math.min(
    structure.userData.structure.rootFlareHeight,
    structure.userData.structure.lowestBranchHeight ?? Number.POSITIVE_INFINITY,
  );
  const flareSpan = flareHeight - rootBase.y;
  // The root flare occupies the same height band on every preset, so the frame
  // follows that band rather than a fraction of the tree. A frame sized for a
  // full grown trunk would reach into a bush's branches and score the gaps
  // between them as trunk defects.
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

export class CanopySolidityProbe {
  constructor({
    root = document.documentElement,
    configLoader = new YamlConfigLoader(),
  } = {}) {
    this.root = root;
    this.configLoader = configLoader;
    this.enabled = isSolidityRequested();
    this.views = createViewDefinitions();
  }

  install() {
    if (!this.enabled) return;
    this.root.dataset[STATUS_ATTRIBUTE] = 'pending';
  }

  async run({ renderer, scene, trees }) {
    if (!this.enabled) return null;

    try {
      const { thresholds } = await this.configLoader.load(THRESHOLD_URL);

      if (!thresholds) {
        throw new Error('The canopy solidity configuration has no thresholds.');
      }

      const report = this.measure({ renderer, scene, trees });
      const failures = evaluateSolidityReport(report.trees, thresholds);
      const passed = failures.length === 0;
      report.passed = passed;
      report.failures = failures;

      this.root.dataset[STATUS_ATTRIBUTE] = passed ? 'ready' : 'error';
      this.root.dataset.solidityTreeCount = String(report.trees.length);
      this.root.dataset.solidityViewCount = String(this.views.length);
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
      console.error('Canopy solidity probe failed.', error);
      return null;
    }
  }

  measure({ renderer, scene, trees }) {
    const resolution = CANOPY_SOLIDITY_CONSTANTS.resolution;
    const target = new THREE.WebGLRenderTarget(resolution, resolution);
    const pixels = new Uint8Array(resolution * resolution * 4);
    const restore = this.beginIsolation(renderer, scene);
    const results = [];

    try {
      for (const tree of trees) {
        results.push(
          this.measureTree({ renderer, scene, tree, target, pixels, resolution }),
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

    // Everything except the lights is hidden, including the other trees. A
    // neighbouring canopy in frame would otherwise close a background region and
    // be scored as a hole in the tree under test.
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

  measureTree({ renderer, scene, tree, target, pixels, resolution }) {
    const lodState = tree.userData.lod;
    lodState.buildHero?.();
    const level = lodState.levels[0];
    const structure = findStructure(level);

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
      crown: createCrownFrame(level),
      base: createBaseFrame(tree, structure),
    };
    const views = [];
    const holeMask = new Uint8Array(resolution * resolution);
    let worst = null;
    let windMovedRatio = 0;

    try {
      for (const view of this.views) {
        const frame = frames[view.group];
        // Base views judge the trunk sweep, so foliage is removed rather than
        // allowed to contribute its own gaps to the trunk measurement.
        this.setFoliageVisible(level, view.group !== 'base');
        this.placeCamera(camera, frame, view);
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
        holeMask.fill(0);
        const metrics = analyzeSilhouetteHoles(mask, resolution, resolution, {
          minimumHolePixels: CANOPY_SOLIDITY_CONSTANTS.minimumHolePixels,
          minimumHoleRadius: CANOPY_SOLIDITY_CONSTANTS.minimumHoleRadius,
          holeMask,
        });
        views.push({ ...view, ...metrics });

        if (!worst || metrics.holeRatio > worst.holeRatio) {
          worst = {
            holeRatio: metrics.holeRatio,
            name: `${view.group}-${view.name}`,
            image: createSolidityViewImage(
              pixels,
              holeMask,
              resolution,
              resolution,
            ),
          };
        }
      }
      this.setFoliageVisible(level, true);
      windMovedRatio = this.measureWind({
        renderer,
        scene,
        camera,
        frame: frames.crown,
        view: this.views[0],
        target,
        pixels,
        resolution,
        tree,
      });
    } finally {
      this.setFoliageVisible(level, true);
      restoreTree();
    }

    return {
      windMovedRatio: windMovedRatio,
      presetId: tree.userData.tree.presetId,
      seed: tree.userData.tree.seed,
      trunkClosed: structure.userData.structure.trunkClosed === true,
      trunkOutwardFacing:
        structure.userData.structure.trunkOutwardFacing === true,
      trunkBoundaryEdges: structure.userData.structure.trunkBoundaryEdges,
      rootBaseMaximumHeight: structure.userData.structure.rootBaseMaximumHeight,
      summary: summarizeViewMetrics(views),
      worstView: worst ? { name: worst.name, image: worst.image } : null,
      views,
    };
  }

  /**
   * Fraction of canopy pixels that change between two wind phases. Shader wind is
   * invisible in a still capture, so without this a broken uniform or a severed
   * animation loop would leave every other gate green.
   */
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

  isolateTree(tree, lodState) {
    const previousTreeVisible = tree.visible;
    const previousProxyVisible = lodState.shadowProxy.visible;
    const previousWind = [];

    tree.visible = true;
    lodState.shadowProxy.visible = false;
    lodState.levels.forEach((level, index) => {
      setObjectLodFade(level, index === 0 ? 1 : 0);
    });
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
  }
}
