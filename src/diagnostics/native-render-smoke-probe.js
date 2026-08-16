import { logger } from '../core/logger.js';
import { reportQaStatus, serializeQaError } from './qa-status-reporter.js';
import {
  restoreObjectLodFade,
  setObjectLodFade,
  snapshotObjectLodFade,
} from '../rendering/lod-dither-fade.js';
import {
  TREE_RENDER_REPRESENTATION_ROLES,
  TREE_REPRESENTATION_ROLES,
  treeRepresentationIndex,
} from '../rendering/tree-representation-role.js';

const RENDER_SMOKE_QUERY_VALUE = 'render-smoke';
const STATUS_ATTRIBUTE = 'renderStatus';
const ERROR_ATTRIBUTE = 'renderError';

function isRenderSmokeRequested() {
  return (
    new URLSearchParams(window.location.search).get('qa') ===
    RENDER_SMOKE_QUERY_VALUE
  );
}

function findNativeTrees(scene) {
  const trees = [];
  scene.traverse((object) => {
    if (object.userData?.tree && object.userData?.lod?.levels) trees.push(object);
  });
  return trees;
}

function hasDrawableImpostor(lodState) {
  const impostor = lodState.levels[3].children.find(
    (child) => child.name === 'tree-impostor',
  );
  if (impostor?.material?.map?.image) return true;
  return Boolean(lodState.billboardBatch?.batch?.atlas?.texture?.image);
}

function hasUserDataMarker(root, marker) {
  let found = false;
  root.traverse((object) => {
    if (object.userData?.[marker]) found = true;
  });
  return found;
}

function collectNativeMetrics(trees) {
  if (trees.length === 0) {
    throw new Error('Native render smoke found no Tree IR trees.');
  }

  const aggregateIndex = treeRepresentationIndex(
    TREE_REPRESENTATION_ROLES.AGGREGATE,
  );
  const metrics = {
    treeCount: trees.length,
    palmCount: 0,
    broadleafCount: 0,
    heroDrawCalls: 0,
    nearDrawCalls: 0,
    aggregateDrawCalls: 0,
    impostorDrawCalls: 0,
    frondBatchCount: 0,
    aggregateFrondProxyCount: 0,
    foliageCardBatchCount: 0,
    billboardBatchTreeCount: 0,
  };

  for (const tree of trees) {
    const treeState = tree.userData.tree;
    const lodState = tree.userData.lod;
    if (!treeState.generationModel) {
      throw new Error(`Native tree '${treeState.presetId}' has no generation model metadata.`);
    }
    if (!lodState.heroReady) {
      throw new Error(`Native tree '${treeState.presetId}' did not build its hero representation.`);
    }
    if (lodState.levels.length !== TREE_RENDER_REPRESENTATION_ROLES.length) {
      throw new Error(`Native tree '${treeState.presetId}' has an incomplete LOD set.`);
    }

    lodState.levels.forEach((level, index) => {
      const expectedRole = TREE_RENDER_REPRESENTATION_ROLES[index];
      const metadata = level.userData?.lod;
      if (metadata?.role !== expectedRole || metadata.index !== index) {
        throw new Error(
          `Native tree '${treeState.presetId}' LOD ${index} does not expose role '${expectedRole}'.`,
        );
      }
      if (!Number.isFinite(metadata.drawCalls) || metadata.drawCalls <= 0) {
        throw new Error(
          `Native tree '${treeState.presetId}' representation '${expectedRole}' has no draw calls.`,
        );
      }
    });

    metrics.heroDrawCalls += lodState.levels[0].userData.lod.drawCalls;
    metrics.nearDrawCalls += lodState.levels[1].userData.lod.drawCalls;
    metrics.aggregateDrawCalls += lodState.levels[2].userData.lod.drawCalls;
    metrics.impostorDrawCalls += lodState.levels[3].userData.lod.drawCalls;

    let hasFronds = false;
    let hasFoliageCards = false;
    tree.traverse((object) => {
      if (object.userData?.fronds) {
        hasFronds = true;
        metrics.frondBatchCount += 1;
      }
      if (object.userData?.foliageCards) {
        hasFoliageCards = true;
        metrics.foliageCardBatchCount += 1;
      }
    });

    if (treeState.generationModel === 'palm') {
      metrics.palmCount += 1;
      if (!hasFronds) {
        throw new Error(`Palm '${treeState.presetId}' has no native frond batch.`);
      }
      if (!hasUserDataMarker(lodState.levels[aggregateIndex], 'fronds')) {
        throw new Error(
          `Palm '${treeState.presetId}' aggregate representation has no frond proxy.`,
        );
      }
      metrics.aggregateFrondProxyCount += 1;
    }
    if (treeState.generationModel === 'sympodial-broadleaf') {
      metrics.broadleafCount += 1;
      if (!hasFoliageCards) {
        throw new Error(
          `Broadleaf '${treeState.presetId}' has no native foliage-card batch.`,
        );
      }
    }

    if (!lodState.shadowProxy) {
      throw new Error(`Native tree '${treeState.presetId}' has no shadow proxy.`);
    }
    if (!hasDrawableImpostor(lodState)) {
      throw new Error(`Native tree '${treeState.presetId}' has no drawable impostor.`);
    }
    if (lodState.billboardBatch) metrics.billboardBatchTreeCount += 1;
  }

  if (metrics.palmCount === 0 || metrics.broadleafCount === 0) {
    throw new Error('Native render smoke must exercise both palm and broadleaf models.');
  }
  return metrics;
}

async function compileAllRepresentations(renderer, scene, camera, trees) {
  const levelSnapshots = [];
  const batchVisibility = new Map();

  try {
    for (const tree of trees) {
      const lodState = tree.userData.lod;
      for (const level of lodState.levels) {
        levelSnapshots.push([level, snapshotObjectLodFade(level)]);
        setObjectLodFade(level, 1);
      }
      const batchMesh = lodState.billboardBatch?.batch?.mesh;
      if (batchMesh && !batchVisibility.has(batchMesh)) {
        batchVisibility.set(batchMesh, batchMesh.visible);
        batchMesh.visible = true;
      }
    }

    if (typeof renderer.compileAsync === 'function') {
      await renderer.compileAsync(scene, camera);
    } else {
      renderer.compile(scene, camera);
    }
  } finally {
    for (const [level, snapshot] of levelSnapshots) {
      restoreObjectLodFade(level, snapshot);
    }
    for (const [mesh, visible] of batchVisibility) mesh.visible = visible;
  }
}

export class NativeRenderSmokeProbe {
  constructor({ root = document.documentElement } = {}) {
    this.root = root;
    this.enabled = isRenderSmokeRequested();
    this.failed = false;
  }

  install(renderer) {
    if (!this.enabled) return;
    this.root.dataset[STATUS_ATTRIBUTE] = 'pending';
    renderer.debug.checkShaderErrors = true;
    renderer.debug.onShaderError = (...details) => {
      this.fail(
        new Error(
          `Native WebGL shader compilation failed (${details.length} diagnostic values).`,
        ),
      );
    };
  }

  async compile(renderer, scene, camera) {
    if (!this.enabled) return;

    try {
      const trees = findNativeTrees(scene);
      const metrics = collectNativeMetrics(trees);
      await compileAllRepresentations(renderer, scene, camera, trees);
      if (this.failed) return;

      this.root.dataset[STATUS_ATTRIBUTE] = 'ready';
      for (const [key, value] of Object.entries(metrics)) {
        this.root.dataset[key] = String(value);
      }
      reportQaStatus('ready');
    } catch (error) {
      this.fail(error);
    }
  }

  fail(error) {
    if (!this.enabled || this.failed) return;
    this.failed = true;
    const message = serializeQaError(error);
    this.root.dataset[STATUS_ATTRIBUTE] = 'error';
    this.root.dataset[ERROR_ATTRIBUTE] = message;
    reportQaStatus('error', message);
    logger.error('Native render smoke probe failed.', error);
  }
}

export function markNativeRenderSmokeBootstrapFailure(error) {
  if (!isRenderSmokeRequested()) return;
  const message = serializeQaError(error);
  document.documentElement.dataset[STATUS_ATTRIBUTE] = 'error';
  document.documentElement.dataset[ERROR_ATTRIBUTE] = message;
  reportQaStatus('error', message);
}
