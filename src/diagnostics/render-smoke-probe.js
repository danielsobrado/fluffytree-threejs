const RENDER_SMOKE_QUERY_VALUE = 'render-smoke';
const STATUS_ATTRIBUTE = 'renderStatus';
const ERROR_ATTRIBUTE = 'renderError';
const CROWN_NAME = 'unified-crown';

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

function collectCrownMetrics(scene) {
  let crownCount = 0;
  let crownTriangles = 0;
  let crownVertices = 0;

  scene.traverse((object) => {
    if (object.name !== CROWN_NAME) return;

    crownCount += 1;
    crownTriangles += Number(object.geometry?.userData?.volume?.triangleCount ?? 0);
    crownVertices += Number(object.geometry?.userData?.volume?.vertexCount ?? 0);
  });

  if (crownCount === 0 || crownTriangles === 0 || crownVertices === 0) {
    throw new Error('Unified crown geometry was not present in the rendered scene.');
  }

  return { crownCount, crownTriangles, crownVertices };
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
      const crownMetrics = collectCrownMetrics(scene);

      if (typeof renderer.compileAsync === 'function') {
        await renderer.compileAsync(scene, camera);
      } else {
        renderer.compile(scene, camera);
      }

      if (!this.failed) {
        this.root.dataset[STATUS_ATTRIBUTE] = 'ready';
        this.root.dataset.renderCalls = String(renderer.info.render.calls);
        this.root.dataset.renderTriangles = String(renderer.info.render.triangles);
        this.root.dataset.crownCount = String(crownMetrics.crownCount);
        this.root.dataset.crownTriangles = String(crownMetrics.crownTriangles);
        this.root.dataset.crownVertices = String(crownMetrics.crownVertices);
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
