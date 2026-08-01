const RENDER_SMOKE_QUERY_VALUE = 'render-smoke';
const STATUS_ATTRIBUTE = 'renderStatus';
const ERROR_ATTRIBUTE = 'renderError';
const CROWN_NAME = 'unified-crown';
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
    crownCount: 0,
    crownTriangles: 0,
    crownVertices: 0,
    leafClusterCount: 0,
    leafCount: 0,
    closedRootCount: 0,
  };

  scene.traverse((object) => {
    if (object.name === CROWN_NAME) {
      metrics.crownCount += 1;
      metrics.crownTriangles += Number(
        object.geometry?.userData?.volume?.triangleCount ?? 0,
      );
      metrics.crownVertices += Number(
        object.geometry?.userData?.volume?.vertexCount ?? 0,
      );
    }

    if (object.name === LEAF_DETAIL_NAME) {
      metrics.leafClusterCount += Number(
        object.userData?.leafDetail?.clusterCount ?? 0,
      );
      metrics.leafCount += Number(object.userData?.leafDetail?.leafCount ?? 0);
    }

    if (
      object.name === STRUCTURE_NAME &&
      object.userData?.structure?.rootCapped === true &&
      Number(object.userData?.structure?.rootEmbedDepth ?? 0) > 0
    ) {
      metrics.closedRootCount += 1;
    }
  });

  if (
    metrics.crownCount === 0 ||
    metrics.crownTriangles === 0 ||
    metrics.crownVertices === 0
  ) {
    throw new Error('Unified crown geometry was not present in the rendered scene.');
  }

  if (metrics.leafClusterCount === 0 || metrics.leafCount === 0) {
    throw new Error('Visible leaf detail was not present in the rendered scene.');
  }

  if (metrics.closedRootCount !== metrics.crownCount) {
    throw new Error('One or more tree roots were not capped and embedded.');
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
        this.root.dataset.crownCount = String(sceneMetrics.crownCount);
        this.root.dataset.crownTriangles = String(sceneMetrics.crownTriangles);
        this.root.dataset.crownVertices = String(sceneMetrics.crownVertices);
        this.root.dataset.leafClusterCount = String(
          sceneMetrics.leafClusterCount,
        );
        this.root.dataset.leafCount = String(sceneMetrics.leafCount);
        this.root.dataset.closedRootCount = String(sceneMetrics.closedRootCount);
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
