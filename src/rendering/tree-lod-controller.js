import * as THREE from 'three';
import { logger } from '../core/logger.js';
import { setObjectLodFade } from './lod-dither-fade.js';
import {
  calculateLodWeights,
  remapUnavailableLodWeights,
  resolveStableLod,
} from './tree-lod-math.js';
import {
  calculateCameraFocalPixels,
  calculateProjectedTreePixels,
  resolveTreeWorldScale,
} from './tree-projection-math.js';
import {
  isImpostorRepresentation,
  TREE_REPRESENTATION_ROLES,
  treeRepresentationIndex,
  treeRepresentationRoleAt,
} from './tree-representation-role.js';
import { shouldRenderTreeShadowProxy } from './tree-shadow-lod-policy.js';

const VISIBLE_FADE_THRESHOLD = 0.001;
const MINIMUM_TREE_DISTANCE = 0.001;

function heroTaskKey(tree) {
  return `${tree.uuid}:hero`;
}

function logGenerationError(error, tree) {
  const presetId = tree.userData?.tree?.presetId ?? 'unknown';
  logger.error(`Deferred hero generation failed for '${presetId}'.`, error);
}

function findFirstVisibleLevel(weights) {
  for (let index = 0; index < weights.length; index += 1) {
    if (weights[index] > VISIBLE_FADE_THRESHOLD) return index;
  }
  return -1;
}

function representationRole(level, index) {
  return level.userData?.lod?.role ?? treeRepresentationRoleAt(index);
}

function findRoleIndex(levels, role) {
  const index = levels.findIndex(
    (level, levelIndex) => representationRole(level, levelIndex) === role,
  );
  return index >= 0 ? index : treeRepresentationIndex(role);
}

export class TreeLodController {
  constructor(
    settings,
    generationQueue = null,
    onGenerationError = logGenerationError,
  ) {
    this.settings = settings;
    this.generationQueue = generationQueue;
    this.onGenerationError = onGenerationError;
    this.entries = [];
    this.worldPosition = new THREE.Vector3();
    this.worldScale = new THREE.Vector3();
    this.cameraWorldPosition = new THREE.Vector3();
    this.dirty = true;
    this.lastCameraX = Number.NaN;
    this.lastCameraY = Number.NaN;
    this.lastCameraZ = Number.NaN;
    this.lastCameraFov = Number.NaN;
    this.lastViewportHeight = Number.NaN;
    this.lastNearPixels = Number.NaN;
    this.lastMediumPixels = Number.NaN;
    this.lastFarPixels = Number.NaN;
    this.lastCullPixels = Number.NaN;
    this.lastHysteresis = Number.NaN;
    this.lastFadeBand = Number.NaN;
    this.lastShadowPixels = Number.NaN;
    this.focalPixels = 0;
    this.focalCameraFov = Number.NaN;
    this.focalViewportHeight = Number.NaN;
    this.updateStride = Math.max(1, Math.trunc(settings.updateStride ?? 1));
    this.frameIndex = 0;
  }

  /**
   * How many trees each level is carrying right now.
   *
   * A level is only worth having if something is using it, and the only way to
   * see that a forest is running all four at once is to count them. A tree
   * below the cull threshold is reported separately: it still costs an update,
   * but it draws nothing.
   */
  summarize() {
    const levels = [0, 0, 0, 0];
    let culled = 0;

    for (const entry of this.entries) {
      const { currentLevel = 1, projectedPixels = 0 } = entry.tree.userData.lod;

      if (
        projectedPixels < this.settings.cullPixels ||
        currentLevel >= levels.length
      ) {
        culled += 1;
      } else {
        levels[currentLevel] += 1;
      }
    }

    return { levels, culled, total: this.entries.length };
  }

  register(tree) {
    if (this.entries.some((entry) => entry.tree === tree)) return false;
    const lodState = tree.userData.lod;
    this.entries.push({
      tree,
      stableLevel: lodState.currentLevel ?? 1,
      heroLevelIndex: findRoleIndex(
        lodState.levels,
        TREE_REPRESENTATION_ROLES.HERO,
      ),
      appliedFades: new Array(lodState.levels.length).fill(Number.NaN),
      appliedInverts: new Array(lodState.levels.length).fill(null),
      weights: new Array(lodState.levels.length).fill(0),
      availability: {
        minimumLevel: lodState.minimumLevel ?? 0,
        heroReady: lodState.heroReady,
      },
    });
    this.dirty = true;
    return true;
  }

  unregister(tree) {
    const index = this.entries.findIndex((entry) => entry.tree === tree);
    if (index < 0) return false;
    this.entries.splice(index, 1);
    this.generationQueue?.cancel?.(heroTaskKey(tree));
    this.dirty = true;
    return true;
  }

  clear() {
    for (const entry of this.entries) {
      this.generationQueue?.cancel?.(heroTaskKey(entry.tree));
    }
    this.entries.length = 0;
    this.dirty = true;
  }

  queueHeroBuild(entry, lodState) {
    const task = () => {
      try {
        lodState.buildHero?.();
      } catch (error) {
        lodState.heroBuildFailed = true;
        if (this.onGenerationError) {
          this.onGenerationError(error, entry.tree);
          return;
        }
        throw error;
      } finally {
        this.dirty = true;
      }
    };

    if (this.generationQueue) {
      this.generationQueue.enqueue(heroTaskKey(entry.tree), task);
    } else {
      task();
    }
  }

  applyLevelFade(entry, lodState, index, fade, invert) {
    const level = lodState.levels[index];
    const role = representationRole(level, index);

    if (isImpostorRepresentation(role) && lodState.billboardBatch) {
      if (entry.appliedFades[index] !== 0 || entry.appliedInverts[index] !== false) {
        setObjectLodFade(level, 0);
        entry.appliedFades[index] = 0;
        entry.appliedInverts[index] = false;
      }
      lodState.billboardBatchManager.setFade(
        lodState.billboardBatch,
        fade,
        invert,
      );
      return;
    }

    if (
      entry.appliedFades[index] === fade &&
      entry.appliedInverts[index] === invert
    ) {
      return;
    }

    setObjectLodFade(level, fade, invert);
    entry.appliedFades[index] = fade;
    entry.appliedInverts[index] = invert;
  }

  inputsChanged(camera, viewportHeight) {
    camera.getWorldPosition(this.cameraWorldPosition);
    const position = this.cameraWorldPosition;
    const settings = this.settings;
    return (
      this.dirty ||
      position.x !== this.lastCameraX ||
      position.y !== this.lastCameraY ||
      position.z !== this.lastCameraZ ||
      camera.fov !== this.lastCameraFov ||
      viewportHeight !== this.lastViewportHeight ||
      settings.nearPixels !== this.lastNearPixels ||
      settings.mediumPixels !== this.lastMediumPixels ||
      settings.farPixels !== this.lastFarPixels ||
      settings.cullPixels !== this.lastCullPixels ||
      settings.hysteresis !== this.lastHysteresis ||
      settings.fadeBand !== this.lastFadeBand ||
      settings.shadowPixels !== this.lastShadowPixels
    );
  }

  captureInputs(camera, viewportHeight) {
    const position = this.cameraWorldPosition;
    const settings = this.settings;
    this.lastCameraX = position.x;
    this.lastCameraY = position.y;
    this.lastCameraZ = position.z;
    this.lastCameraFov = camera.fov;
    this.lastViewportHeight = viewportHeight;
    this.lastNearPixels = settings.nearPixels;
    this.lastMediumPixels = settings.mediumPixels;
    this.lastFarPixels = settings.farPixels;
    this.lastCullPixels = settings.cullPixels;
    this.lastHysteresis = settings.hysteresis;
    this.lastFadeBand = settings.fadeBand;
    this.lastShadowPixels = settings.shadowPixels;
    this.dirty = false;
  }

  resolveFocalPixels(camera, viewportHeight) {
    if (
      camera.fov === this.focalCameraFov &&
      viewportHeight === this.focalViewportHeight
    ) {
      return this.focalPixels;
    }

    this.focalCameraFov = camera.fov;
    this.focalViewportHeight = viewportHeight;
    this.focalPixels = calculateCameraFocalPixels(camera.fov, viewportHeight);
    return this.focalPixels;
  }

  update(camera, viewportHeight, renderer) {
    this.updateStride = Math.max(
      1,
      Math.trunc(this.settings.updateStride ?? 1),
    );
    if (!this.inputsChanged(camera, viewportHeight) && this.updateStride === 1) {
      return;
    }

    const focalPixels = this.resolveFocalPixels(camera, viewportHeight);
    const prewarmPixels = this.settings.nearPixels * (1 - this.settings.hysteresis);
    let shadowChanged = false;
    const stride = this.updateStride;
    const phase = this.frameIndex % stride;
    this.frameIndex += 1;

    for (let entryIndex = 0; entryIndex < this.entries.length; entryIndex += 1) {
      if (stride > 1 && entryIndex % stride !== phase) continue;
      const entry = this.entries[entryIndex];
      const treeState = entry.tree.userData.tree;
      const lodState = entry.tree.userData.lod;
      entry.tree.getWorldPosition(this.worldPosition);
      entry.tree.getWorldScale(this.worldScale);
      const distance = Math.max(
        MINIMUM_TREE_DISTANCE,
        this.cameraWorldPosition.distanceTo(this.worldPosition),
      );
      const projectedPixels = calculateProjectedTreePixels(
        treeState.height,
        distance,
        focalPixels,
        resolveTreeWorldScale(this.worldScale),
      );
      const minimumLevel = lodState.minimumLevel ?? 0;
      entry.stableLevel = Math.max(
        minimumLevel,
        resolveStableLod(
          projectedPixels,
          entry.stableLevel,
          this.settings,
        ),
      );

      if (
        minimumLevel <= entry.heroLevelIndex &&
        !lodState.heroReady &&
        !lodState.heroBuildFailed &&
        projectedPixels >= prewarmPixels
      ) {
        this.queueHeroBuild(entry, lodState);
      }

      const weights = calculateLodWeights(
        projectedPixels,
        this.settings,
        entry.weights,
      );
      entry.availability.minimumLevel = minimumLevel;
      entry.availability.heroReady = lodState.heroReady;
      remapUnavailableLodWeights(weights, entry.availability, weights);
      const firstVisibleLevel = findFirstVisibleLevel(weights);

      for (let index = 0; index < lodState.levels.length; index += 1) {
        const invert =
          weights[index] > VISIBLE_FADE_THRESHOLD &&
          firstVisibleLevel >= 0 &&
          index !== firstVisibleLevel;
        this.applyLevelFade(entry, lodState, index, weights[index], invert);
      }

      const activeLevel = lodState.levels[entry.stableLevel];
      const activeRole = representationRole(activeLevel, entry.stableLevel);
      const castsShadow = shouldRenderTreeShadowProxy(
        activeRole,
        projectedPixels,
        this.settings.shadowPixels,
      );
      const proxy = lodState.shadowProxy;
      if (proxy.visible !== castsShadow) {
        proxy.visible = castsShadow;
        shadowChanged = true;
      }
      lodState.currentLevel = entry.stableLevel;
      lodState.currentRole = activeRole;
      lodState.projectedPixels = projectedPixels;
    }

    if (shadowChanged && renderer?.shadowMap) renderer.shadowMap.needsUpdate = true;
    this.captureInputs(camera, viewportHeight);
  }
}
