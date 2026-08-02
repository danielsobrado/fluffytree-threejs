import { RENDER_SMOKE_CONSTANTS } from './render-smoke-constants.js';
import { reportQaStatus, serializeQaError } from './qa-status-reporter.js';

const RENDER_SMOKE_QUERY_VALUE = 'render-smoke';
const STATUS_ATTRIBUTE = 'renderStatus';
const ERROR_ATTRIBUTE = 'renderError';
const CROWN_PROXY_NAME = 'crown-shadow-proxy';
const HERO_LEAF_NAME = 'hero-leaf-shell';
const STRUCTURE_NAME = 'tree-structure';

function isRenderSmokeRequested() {
  return (
    new URLSearchParams(window.location.search).get('qa') ===
    RENDER_SMOKE_QUERY_VALUE
  );
}

function validateReleaseTitles(root) {
  const releaseVersion = root.dataset.releaseVersion;
  const overlayTitle = document.querySelector('.demo-overlay h1')?.textContent ?? '';

  if (!releaseVersion) {
    throw new Error('The uploaded release version was not published to the page.');
  }
  if (!document.title.includes(releaseVersion)) {
    throw new Error('The browser title does not contain the uploaded release version.');
  }
  if (!overlayTitle.includes(releaseVersion)) {
    throw new Error('The visible demo title does not contain the uploaded release version.');
  }
  return releaseVersion;
}

function collectSceneMetrics(scene) {
  const metrics = {
    treeCount: 0,
    shadowProxyCount: 0,
    crownTriangles: 0,
    leafClusterCount: 0,
    leafCount: 0,
    foliageCoreCount: 0,
    foliageShellCount: 0,
    lodCounts: [0, 0, 0, 0],
    maximumLodTriangles: [0, 0, 0, 0],
    maximumLodDrawCalls: [0, 0, 0, 0],
    closedTrunkCount: 0,
    trunkBoundaryEdges: 0,
    maximumRootBaseHeight: Number.NEGATIVE_INFINITY,
  };

  scene.traverse((object) => {
    if (object.userData?.tree) metrics.treeCount += 1;

    if (object.name === CROWN_PROXY_NAME) {
      metrics.shadowProxyCount += 1;
      metrics.crownTriangles += Number(
        object.userData?.shadowProxy?.triangleCount ?? 0,
      );

      if (
        object.userData?.shadowProxy?.visibleSurface !== false ||
        object.material?.colorWrite !== false ||
        object.material?.depthWrite !== false
      ) {
        throw new Error('A smooth crown blob is still visible in the color pass.');
      }
    }

    if (object.name === HERO_LEAF_NAME) {
      const heroLeaves = object.userData?.heroLeaves ?? {};
      metrics.leafClusterCount += Number(heroLeaves.clusterCount ?? 0);
      metrics.leafCount += Number(heroLeaves.leafCount ?? 0);
    }

    if (object.userData?.foliageCore) metrics.foliageCoreCount += 1;
    if (object.userData?.foliageShell) metrics.foliageShellCount += 1;
    const lod = object.userData?.lod;
    if (Number.isInteger(lod?.index)) {
      metrics.lodCounts[lod.index] += 1;
      metrics.maximumLodTriangles[lod.index] = Math.max(
        metrics.maximumLodTriangles[lod.index],
        Number(lod.triangles ?? 0),
      );
      metrics.maximumLodDrawCalls[lod.index] = Math.max(
        metrics.maximumLodDrawCalls[lod.index],
        Number(lod.drawCalls ?? 0),
      );
    }

    if (object.name === STRUCTURE_NAME && object.userData?.structure) {
      const structure = object.userData.structure;
      metrics.trunkBoundaryEdges +=
        Number(structure.trunkBoundaryEdges ?? 0) +
        Number(structure.trunkNonManifoldEdges ?? 0);
      metrics.maximumRootBaseHeight = Math.max(
        metrics.maximumRootBaseHeight,
        Number(structure.rootBaseMaximumHeight ?? 0),
      );

      if (
        structure.trunkClosed === true &&
        structure.trunkOutwardFacing === true &&
        Number(structure.rootEmbedDepth ?? 0) > 0 &&
        Number(structure.rootFlareHeight ?? 0) > 0
      ) {
        metrics.closedTrunkCount += 1;
      }
    }
  });

  if (
    metrics.treeCount === 0 ||
    metrics.shadowProxyCount !== metrics.treeCount ||
    metrics.crownTriangles === 0 ||
    metrics.crownTriangles >
      metrics.treeCount * RENDER_SMOKE_CONSTANTS.maximumShadowTrianglesPerTree
  ) {
    throw new Error('Invisible crown shadow proxies are incomplete.');
  }

  const perTree = (value) => metrics.treeCount * value;
  if (
    metrics.leafClusterCount <
      perTree(RENDER_SMOKE_CONSTANTS.minimumHeroLeafClustersPerTree) ||
    metrics.leafCount === 0 ||
    metrics.foliageCoreCount <
      perTree(RENDER_SMOKE_CONSTANTS.minimumFoliageCoresPerTree) ||
    metrics.foliageShellCount <
      perTree(RENDER_SMOKE_CONSTANTS.minimumFoliageShellsPerTree)
  ) {
    throw new Error('Visible leaf geometry is not dense enough.');
  }

  for (let index = 0; index < 4; index += 1) {
    if (
      metrics.lodCounts[index] !== metrics.treeCount ||
      metrics.maximumLodTriangles[index] >
        RENDER_SMOKE_CONSTANTS.maximumLodTriangles[index] ||
      metrics.maximumLodDrawCalls[index] >
        RENDER_SMOKE_CONSTANTS.maximumLodDrawCalls[index]
    ) {
      throw new Error(`Tree LOD ${index} is incomplete or over budget.`);
    }
  }

  if (
    metrics.closedTrunkCount !== metrics.treeCount ||
    metrics.trunkBoundaryEdges !== 0 ||
    metrics.maximumRootBaseHeight >
      RENDER_SMOKE_CONSTANTS.maximumRootBaseHeight
  ) {
    throw new Error(
      'One or more trunks are not an outward-facing closed sweep buried under the terrain.',
    );
  }

  return metrics;
}

export class RenderSmokeProbe {
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
          `WebGL shader compilation failed (${details.length} diagnostic values).`,
        ),
      );
    };
  }

  async compile(renderer, scene, camera) {
    if (!this.enabled) return;

    try {
      const releaseVersion = validateReleaseTitles(this.root);
      const sceneMetrics = collectSceneMetrics(scene);

      if (typeof renderer.compileAsync === 'function') {
        await renderer.compileAsync(scene, camera);
      } else {
        renderer.compile(scene, camera);
      }

      if (!this.failed) {
        this.root.dataset[STATUS_ATTRIBUTE] = 'ready';
        this.root.dataset.releaseVersion = releaseVersion;
        this.root.dataset.renderCalls = String(renderer.info.render.calls);
        this.root.dataset.renderTriangles = String(renderer.info.render.triangles);

        for (const [key, value] of Object.entries(sceneMetrics)) {
          this.root.dataset[key] = String(value);
        }
        reportQaStatus('ready');
      }
    } catch (error) {
      this.fail(error);
    }
  }

  fail(error) {
    if (!this.enabled) return;

    this.failed = true;
    this.root.dataset[STATUS_ATTRIBUTE] = 'error';
    this.root.dataset[ERROR_ATTRIBUTE] = serializeQaError(error);
    reportQaStatus('error', serializeQaError(error));
    console.error('Render smoke probe failed.', error);
  }
}

export function markRenderSmokeBootstrapFailure(error) {
  if (!isRenderSmokeRequested()) return;

  document.documentElement.dataset[STATUS_ATTRIBUTE] = 'error';
  document.documentElement.dataset[ERROR_ATTRIBUTE] = serializeQaError(error);
  reportQaStatus('error', serializeQaError(error));
}
