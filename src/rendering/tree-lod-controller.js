import * as THREE from 'three';
import { logger } from '../core/logger.js';
import { setObjectLodFade } from './lod-dither-fade.js';
import {
  calculateLodWeights,
  remapUnavailableLodWeights,
  resolveStableLod,
} from './tree-lod-math.js';

const VISIBLE_FADE_THRESHOLD = 0.001;

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
  }

  register(tree) {
    this.entries.push({
      tree,
      stableLevel: tree.userData.lod.currentLevel ?? 1,
      appliedFades: new Array(tree.userData.lod.levels.length).fill(Number.NaN),
      appliedInverts: new Array(tree.userData.lod.levels.length).fill(null),
    });
  }

  clear() {
    this.entries.length = 0;
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
      }
    };

    if (this.generationQueue) {
      this.generationQueue.enqueue(`${entry.tree.uuid}:hero`, task);
    } else {
      task();
    }
  }

  applyLevelFade(entry, lodState, index, fade, invert) {
    const level = lodState.levels[index];

    if (index === 3 && lodState.billboardBatch) {
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

  update(camera, viewportHeight, renderer) {
    const focalPixels =
      viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5));
    let shadowChanged = false;

    for (const entry of this.entries) {
      entry.tree.getWorldPosition(this.worldPosition);
      const distance = Math.max(0.001, camera.position.distanceTo(this.worldPosition));
      const projectedPixels =
        (entry.tree.userData.tree.height / distance) * focalPixels;
      const lodState = entry.tree.userData.lod;
      const minimumLevel = lodState.minimumLevel ?? 0;
      entry.stableLevel = Math.max(
        minimumLevel,
        resolveStableLod(
          projectedPixels,
          entry.stableLevel,
          this.settings,
        ),
      );

      const prewarmPixels = this.settings.nearPixels * (1 - this.settings.hysteresis);
      if (
        minimumLevel === 0 &&
        !lodState.heroReady &&
        !lodState.heroBuildFailed &&
        projectedPixels >= prewarmPixels
      ) {
        this.queueHeroBuild(entry, lodState);
      }

      const weights = remapUnavailableLodWeights(
        calculateLodWeights(projectedPixels, this.settings),
        { minimumLevel, heroReady: lodState.heroReady },
      );
      const firstVisibleLevel = findFirstVisibleLevel(weights);

      for (let index = 0; index < lodState.levels.length; index += 1) {
        const invert =
          weights[index] > VISIBLE_FADE_THRESHOLD &&
          firstVisibleLevel >= 0 &&
          index !== firstVisibleLevel;
        this.applyLevelFade(entry, lodState, index, weights[index], invert);
      }

      const castsShadow =
        projectedPixels >= this.settings.shadowPixels && entry.stableLevel <= 1;
      const proxy = lodState.shadowProxy;
      if (proxy.visible !== castsShadow) {
        proxy.visible = castsShadow;
        shadowChanged = true;
      }
      entry.tree.userData.lod.currentLevel = entry.stableLevel;
      entry.tree.userData.lod.projectedPixels = projectedPixels;
    }

    if (shadowChanged && renderer?.shadowMap) renderer.shadowMap.needsUpdate = true;
  }
}
