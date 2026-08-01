import { RENDER_SMOKE_CONSTANTS } from './render-smoke-constants.js';

const RENDER_SMOKE_QUERY_VALUE = 'render-smoke';
const STATUS_ATTRIBUTE = 'renderStatus';
const ERROR_ATTRIBUTE = 'renderError';
const CROWN_PROXY_NAME = 'crown-shadow-proxy';
const LEAF_DETAIL_NAME = 'leaf-detail-shell';
const STRUCTURE_NAME = 'tree-structure';

function isRenderSmokeRequested() {
  return (
    new URLSearchParams(window.location.search).get('qa') ===
    RENDER_SMOKE_QUERY_VALUE
  );
}

function serializeError(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
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
    crownVertices: 0,
    leafClusterCount: 0,
    leafCount: 0,
    minimumLeafLayers: Number.POSITIVE_INFINITY,
    rootCollarCount: 0,
    minimumRootCollarOverlap: Number.POSITIVE_INFINITY,
  };

  scene.traverse((object) => {
    if (object.userData?.tree) {
      metrics.treeCount += 1;
    }

    if (object.name === CROWN_PROXY_NAME) {
      metrics.shadowProxyCount += 1;
      metrics.crownTriangles += Number(
        object.geometry?.userData?.volume?.triangleCount ?? 0,
      );
      metrics.crownVertices += Number(
        object.geometry?.userData?.volume?.vertexCount ?? 0,
      );

      if (
        object.userData?.shadowProxy?.visibleSurface !== false ||
        object.material?.colorWrite !== false ||
        object.material?.depthWrite !== false
      ) {
        throw new Error('A smooth crown blob is still visible in the color pass.');
      }
    }

    if (object.name === LEAF_DETAIL_NAME) {
      metrics.leafClusterCount += Number(
        object.userData?.leafDetail?.clusterCount ?? 0,
      );
      metrics.leafCount += Number(object.userData?.leafDetail?.leafCount ?? 0);
      metrics.minimumLeafLayers = Math.min(
        metrics.minimumLeafLayers,
        Number(object.userData?.leafDetail?.layerCount ?? 0),
      );
    }

    if (
      object.name === STRUCTURE_NAME &&
      object.userData?.structure?.rootCapped === true &&
      object.userData?.structure?.rootCollar === true &&
      Number(object.userData?.structure?.rootEmbedDepth ?? 0) > 0 &&
      Number(object.userData?.structure?.rootCollarHeight ?? 0) > 0
    ) {
      metrics.rootCollarCount += 1;
      metrics.minimumRootCollarOverlap = Math.min(
        metrics.minimumRootCollarOverlap,
        Number(object.userData?.structure?.rootCollarOverlap ?? 0),
      );
    }
  });

  if (
    metrics.treeCount === 0 ||
    metrics.shadowProxyCount !== metrics.treeCount ||
    metrics.crownTriangles === 0 ||
    metrics.crownVertices === 0
  ) {
    throw new Error('Invisible crown shadow proxies are incomplete.');
  }

  const minimumLeafClusters =
    metrics.treeCount * RENDER_SMOKE_CONSTANTS.minimumLeafClustersPerTree;
  if (
    metrics.leafClusterCount < minimumLeafClusters ||
    metrics.leafCount === 0 ||
    metrics.minimumLeafLayers < RENDER_SMOKE_CONSTANTS.minimumLeafLayers
  ) {
    throw new Error('Visible leaf shells are not dense enough to close canopy gaps.');
  }

  if (
    metrics.rootCollarCount !== metrics.treeCount ||
    metrics.minimumRootCollarOverlap <
      RENDER_SMOKE_CONSTANTS.minimumRootCollarOverlap
  ) {
    throw new Error('One or more trunks lack a seamless overlapping root collar.');
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
        this.root.dataset.treeCount = String(sceneMetrics.treeCount);
        this.root.dataset.shadowProxyCount = String(
          sceneMetrics.shadowProxyCount,
        );
        this.root.dataset.crownTriangles = String(sceneMetrics.crownTriangles);
        this.root.dataset.crownVertices = String(sceneMetrics.crownVertices);
        this.root.dataset.leafClusterCount = String(
          sceneMetrics.leafClusterCount,
        );
        this.root.dataset.leafCount = String(sceneMetrics.leafCount);
        this.root.dataset.minimumLeafLayers = String(
          sceneMetrics.minimumLeafLayers,
        );
        this.root.dataset.rootCollarCount = String(
          sceneMetrics.rootCollarCount,
        );
        this.root.dataset.minimumRootCollarOverlap = String(
          sceneMetrics.minimumRootCollarOverlap,
        );
      }
    } catch (error) {
      this.fail(error);
    }
  }

  fail(error) {
    if (!this.enabled) return;

    this.failed = true;
    this.root.dataset[STATUS_ATTRIBUTE] = 'error';
    this.root.dataset[ERROR_ATTRIBUTE] = serializeError(error);
    console.error('Render smoke probe failed.', error);
  }
}

export function markRenderSmokeBootstrapFailure(error) {
  if (!isRenderSmokeRequested()) return;

  document.documentElement.dataset[STATUS_ATTRIBUTE] = 'error';
  document.documentElement.dataset[ERROR_ATTRIBUTE] = serializeError(error);
}
