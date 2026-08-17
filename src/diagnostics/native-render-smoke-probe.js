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

function findUserDataMarker(root, marker) {
  let metadata = null;
  root.traverse((object) => {
    if (!metadata && object.userData?.[marker]) {
      metadata = object.userData[marker];
    }
  });
  return metadata;
}

function hasUserDataMarker(root, marker) {
  return Boolean(findUserDataMarker(root, marker));
}

function collectNativeMetrics(trees) {
  if (trees.length === 0) {
    throw new Error('Native render smoke found no Tree IR trees.');
  }

  const heroIndex = treeRepresentationIndex(TREE_REPRESENTATION_ROLES.HERO);
  const nearIndex = treeRepresentationIndex(TREE_REPRESENTATION_ROLES.NEAR);
  const aggregateIndex = treeRepresentationIndex(
    TREE_REPRESENTATION_ROLES.AGGREGATE,
  );
  const broadleafLeafShapes = new Set();
  const metrics = {
    treeCount: trees.length,
    palmCount: 0,
    broadleafCount: 0,
    heroDrawCalls: 0,
    nearDrawCalls: 0,
    aggregateDrawCalls: 0,
    impostorDrawCalls: 0,
    frondBatchCount: 0,
    heroLeafletPalmCount: 0,
    aggregateFrondProxyCount: 0,
    palmFrondShadowCount: 0,
    palmBandedTrunkCount: 0,
    foliageCardBatchCount: 0,
    recessedBroadleafCoreCount: 0,
    broadleafLeafShapeCount: 0,
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
      const heroFronds = findUserDataMarker(
        lodState.levels[heroIndex],
        'fronds',
      );
      if (!heroFronds?.leaflets) {
        throw new Error(
          `Palm '${treeState.presetId}' hero representation has no pinnate leaflet geometry.`,
        );
      }
      metrics.heroLeafletPalmCount += 1;

      const heroStructure = findUserDataMarker(
        lodState.levels[heroIndex],
        'structure',
      );
      if (heroStructure?.barkPattern !== 'palm') {
        throw new Error(
          `Palm '${treeState.presetId}' hero trunk has no palm leaf-scar bark pattern.`,
        );
      }
      metrics.palmBandedTrunkCount += 1;

      if (!hasUserDataMarker(lodState.levels[aggregateIndex], 'fronds')) {
        throw new Error(
          `Palm '${treeState.presetId}' aggregate representation has no frond proxy.`,
        );
      }
      if (hasUserDataMarker(lodState.levels[aggregateIndex], 'crownVolumes')) {
        throw new Error(
          `Palm '${treeState.presetId}' aggregate representation still exposes a crown-volume blob.`,
        );
      }
      metrics.aggregateFrondProxyCount += 1;

      if (!lodState.shadowProxy?.userData?.shadowProxy?.frondShadow) {
        throw new Error(
          `Palm '${treeState.presetId}' shadow proxy is not frond-shaped.`,
        );
      }
      metrics.palmFrondShadowCount += 1;
    }
    if (treeState.generationModel === 'sympodial-broadleaf') {
      metrics.broadleafCount += 1;
      if (!hasFoliageCards) {
        throw new Error(
          `Broadleaf '${treeState.presetId}' has no native foliage-card batch.`,
        );
      }
      const heroCards = findUserDataMarker(
        lodState.levels[heroIndex],
        'foliageCards',
      );
      const nearCards = findUserDataMarker(
        lodState.levels[nearIndex],
        'foliageCards',
      );
      const heroCore = findUserDataMarker(
        lodState.levels[heroIndex],
        'crownVolumes',
      );
      if (!heroCards || !nearCards || !heroCore) {
        throw new Error(
          `Broadleaf '${treeState.presetId}' does not expose its complete native canopy hierarchy.`,
        );
      }
      if (!heroCards.leafShape || heroCards.leafShape !== nearCards.leafShape) {
        throw new Error(
          `Broadleaf '${treeState.presetId}' does not preserve its leaf silhouette across detailed LODs.`,
        );
      }
      broadleafLeafShapes.add(heroCards.leafShape);
      if (nearCards.alphaTest > heroCards.alphaTest) {
        throw new Error(
          `Broadleaf '${treeState.presetId}' near foliage alpha cutoff exceeds hero cutoff.`,
        );
      }
      if (
        !(heroCore.scaleMultiplier < 1) ||
        !(heroCore.brightness < 1) ||
        !(heroCore.surfaceVariation > 0)
      ) {
        throw new Error(
          `Broadleaf '${treeState.presetId}' hero crown core is not recessed and organically shaped.`,
        );
      }
      metrics.recessedBroadleafCoreCount += 1;
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
  metrics.broadleafLeafShapeCount = broadleafLeafShapes.size;
  if (
    metrics.broadleafCount > 1 &&
    metrics.broadleafLeafShapeCount < 2
  ) {
    throw new Error(
      'Native render smoke broadleaf species must exercise more than one leaf silhouette.',
    );
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
