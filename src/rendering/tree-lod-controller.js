import * as THREE from 'three';
import { setObjectLodFade } from './lod-dither-fade.js';
import { calculateLodWeights, resolveStableLod } from './tree-lod-math.js';

export class TreeLodController {
  constructor(settings, generationQueue = null) {
    this.settings = settings;
    this.generationQueue = generationQueue;
    this.entries = [];
    this.worldPosition = new THREE.Vector3();
  }

  register(tree) {
    this.entries.push({ tree, stableLevel: tree.userData.lod.currentLevel ?? 1 });
  }

  clear() {
    this.entries.length = 0;
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
      entry.stableLevel = resolveStableLod(
        projectedPixels,
        entry.stableLevel,
        this.settings,
      );
      const lodState = entry.tree.userData.lod;
      const prewarmPixels = this.settings.nearPixels * (1 - this.settings.hysteresis);
      if (!lodState.heroReady && projectedPixels >= prewarmPixels) {
        const task = () => lodState.buildHero?.();
        if (this.generationQueue) {
          this.generationQueue.enqueue(`${entry.tree.uuid}:hero`, task);
        } else {
          task();
        }
      }
      const weights = calculateLodWeights(projectedPixels, this.settings);
      if (!lodState.heroReady) {
        weights[1] += weights[0];
        weights[0] = 0;
      }
      const visibleLevels = weights
        .map((weight, index) => ({ weight, index }))
        .filter(({ weight }) => weight > 0.001);
      lodState.levels.forEach((level, index) => {
        const visibleIndex = visibleLevels.findIndex((entry) => entry.index === index);
        if (index === 3 && lodState.billboardBatch) {
          setObjectLodFade(level, 0);
          lodState.billboardBatchManager.setFade(
            lodState.billboardBatch,
            weights[index],
            visibleIndex === 1,
          );
        } else {
          setObjectLodFade(level, weights[index], visibleIndex === 1);
        }
      });
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
