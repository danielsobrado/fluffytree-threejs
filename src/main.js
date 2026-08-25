import {
  applyDocumentTitle,
  formatOverlayTitle,
  formatReleaseVersion,
} from './app/release-title.js';
import { WorkerTreeDemo } from './app/worker-tree-demo.js';
import { validateSceneConfig } from './config/scene-config-validator.js';
import { YamlConfigLoader } from './config/yaml-config-loader.js';
import { logger } from './core/logger.js';
import { IsolatedCanopySolidityProbe } from './diagnostics/isolated-canopy-solidity-probe.js';
import { markRenderSmokeBootstrapFailure } from './diagnostics/render-smoke-probe.js';
import {
  markStemManifoldBootstrapFailure,
  StemManifoldProbe,
} from './diagnostics/stem-manifold-probe.js';
import { PresetLibrary } from './domain/preset-library.js';
import { parseForestVariantPolicy } from './forest/forest-variant-policy.js';
import {
  CachedTreeGenerator,
  calculateTreeGenerationCacheCapacity,
} from './generation/cached-tree-generator.js';
import { TreeGenerator } from './generation/tree-generator.js';
import { parseShellCoverageQaConfig } from './qa/shell-coverage-qa-config.js';
import { parseTreeStressQaPolicy } from './qa/tree-stress-qa-policy.js';
import { parseFoliageRepresentationPolicy } from './rendering/foliage-representation-policy.js';
import { TreeMeshBuilder } from './rendering/tree-mesh-builder.js';
import { showFatalError } from './ui/demo-overlay.js';
import { createSceneMenu } from './ui/scene-menu.js';
import { createTuningPanel } from './ui/tuning-panel.js';
import {
  parseTreeGenerationRuntimePolicy,
  resolveTreeGenerationWorkerCount,
} from './workers/tree-generation-runtime-policy.js';
import { TreeGenerationWorkerPool } from './workers/tree-generation-worker-pool.js';
import { WorkerTreeGenerationService } from './workers/worker-tree-generation-service.js';

const CONFIG_URLS = Object.freeze({
  release: './config/release.yaml',
  scene: './config/scene.yaml',
  trees: './config/tree-presets.yaml',
  foliageContinuity: './config/foliage-continuity.yaml',
  foliageRendering: './config/foliage-rendering.yaml',
  forestVariants: './config/forest-variant-policy.yaml',
  treeGenerationRuntime: './config/tree-generation-runtime.yaml',
  shellCoverageQa: './config/shell-coverage-qa.yaml',
  treeStressQa: './config/tree-stress-qa.yaml',
  stemManifoldQa: './config/stem-manifold-qa.yaml',
});

function isStemManifoldQaRequested() {
  return new URLSearchParams(window.location.search).get('qa') === 'manifold';
}

async function runStemManifoldQa(loader) {
  const [treeConfig, qaConfig] = await Promise.all([
    loader.load(CONFIG_URLS.trees),
    loader.load(CONFIG_URLS.stemManifoldQa),
  ]);
  const library = PresetLibrary.fromConfig(treeConfig);
  await new StemManifoldProbe().run(library.presets, qaConfig);
}

function createWorkerGenerationService(policy, maximumCacheEntries) {
  const maximumWorkers = resolveTreeGenerationWorkerCount(policy);
  if (maximumWorkers === 0) return null;

  try {
    return new WorkerTreeGenerationService({
      workerPool: new TreeGenerationWorkerPool({
        policy: {
          maximumWorkers,
          terminateOnCancel: policy.terminateOnCancel,
        },
      }),
      maximumCacheEntries,
    });
  } catch (error) {
    logger.warn('Background tree generation is unavailable; using the synchronous path.', {
      error,
    });
    return null;
  }
}

async function bootstrap() {
  const container = document.querySelector('#app');
  let demo = null;

  try {
    if (!container) {
      throw new Error("Required application container '#app' was not found.");
    }

    const loader = new YamlConfigLoader();

    if (isStemManifoldQaRequested()) {
      await runStemManifoldQa(loader);
      return;
    }

    const [
      releaseConfig,
      rawSceneConfig,
      treeConfig,
      continuityConfig,
      rawFoliageRenderingConfig,
      rawForestVariantConfig,
      rawTreeGenerationRuntimeConfig,
      rawCoverageConfig,
      rawStressConfig,
    ] = await Promise.all([
      loader.load(CONFIG_URLS.release),
      loader.load(CONFIG_URLS.scene),
      loader.load(CONFIG_URLS.trees),
      loader.load(CONFIG_URLS.foliageContinuity),
      loader.load(CONFIG_URLS.foliageRendering),
      loader.load(CONFIG_URLS.forestVariants),
      loader.load(CONFIG_URLS.treeGenerationRuntime),
      loader.load(CONFIG_URLS.shellCoverageQa),
      loader.load(CONFIG_URLS.treeStressQa),
    ]);
    const validatedSceneConfig = validateSceneConfig(rawSceneConfig);
    const foliageRenderingPolicy = parseFoliageRepresentationPolicy(
      rawFoliageRenderingConfig,
    );
    const forestVariantPolicy = parseForestVariantPolicy(rawForestVariantConfig);
    const treeGenerationRuntimePolicy = parseTreeGenerationRuntimePolicy(
      rawTreeGenerationRuntimeConfig,
    );
    const coverageConfig = parseShellCoverageQaConfig(rawCoverageConfig);
    const stressPolicy = parseTreeStressQaPolicy(rawStressConfig);
    const releaseVersion = formatReleaseVersion(releaseConfig);
    const overlayTitle = formatOverlayTitle(releaseConfig);
    applyDocumentTitle(releaseConfig);
    const library = PresetLibrary.fromConfig(treeConfig, continuityConfig);
    const sceneConfig = Object.freeze({
      ...validatedSceneConfig,
      forestVariantPolicy,
    });
    const generationCacheCapacity = calculateTreeGenerationCacheCapacity(
      library.presets.size,
      forestVariantPolicy.maximumPerSpecies,
    );
    const workerTreeGenerationService = createWorkerGenerationService(
      treeGenerationRuntimePolicy,
      generationCacheCapacity,
    );
    demo = new WorkerTreeDemo({
      workerTreeGenerationService,
      canopySolidityProbe: new IsolatedCanopySolidityProbe(),
      treeGenerator: new CachedTreeGenerator({
        generator: new TreeGenerator(),
        maximumEntries: generationCacheCapacity,
      }),
      treeMeshBuilder: new TreeMeshBuilder({ foliageRenderingPolicy }),
    });
    demo.start(
      container,
      sceneConfig,
      library,
      releaseVersion,
      overlayTitle,
      {
        coverageProbeOptions: coverageConfig.probe,
        stressPolicy,
      },
    );

    // The QA modes drive the same page. A panel over the canvas would change
    // what every screenshot gate measures, so they stay out of them.
    if (!new URLSearchParams(window.location.search).has('qa')) {
      const panel = createTuningPanel(container, demo, library, {
        coverageThresholds: coverageConfig.thresholds,
      });
      createSceneMenu(container, demo, {
        onSceneChange: () => panel.collapse(),
      });
    }
  } catch (error) {
    demo?.destroy();
    logger.error('Application bootstrap failed.', error);
    markRenderSmokeBootstrapFailure(error);
    markStemManifoldBootstrapFailure(error);
    if (container) showFatalError(container, error);
  }
}

void bootstrap();
