import {
  applyDocumentTitle,
  formatOverlayTitle,
  formatReleaseVersion,
} from './app/release-title.js';
import { TreeDemo } from './app/tree-demo.js';
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
import { parseShellCoverageQaConfig } from './qa/shell-coverage-qa-config.js';
import { parseTreeStressQaPolicy } from './qa/tree-stress-qa-policy.js';
import { parseFoliageRepresentationPolicy } from './rendering/foliage-representation-policy.js';
import { TreeMeshBuilder } from './rendering/tree-mesh-builder.js';
import { showFatalError } from './ui/demo-overlay.js';
import { createSceneMenu } from './ui/scene-menu.js';
import { createTuningPanel } from './ui/tuning-panel.js';

const CONFIG_URLS = Object.freeze({
  release: './config/release.yaml',
  scene: './config/scene.yaml',
  trees: './config/tree-presets.yaml',
  foliageContinuity: './config/foliage-continuity.yaml',
  foliageRendering: './config/foliage-rendering.yaml',
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
      rawCoverageConfig,
      rawStressConfig,
    ] = await Promise.all([
      loader.load(CONFIG_URLS.release),
      loader.load(CONFIG_URLS.scene),
      loader.load(CONFIG_URLS.trees),
      loader.load(CONFIG_URLS.foliageContinuity),
      loader.load(CONFIG_URLS.foliageRendering),
      loader.load(CONFIG_URLS.shellCoverageQa),
      loader.load(CONFIG_URLS.treeStressQa),
    ]);
    const sceneConfig = validateSceneConfig(rawSceneConfig);
    const foliageRenderingPolicy = parseFoliageRepresentationPolicy(
      rawFoliageRenderingConfig,
    );
    const coverageConfig = parseShellCoverageQaConfig(rawCoverageConfig);
    const stressPolicy = parseTreeStressQaPolicy(rawStressConfig);
    const releaseVersion = formatReleaseVersion(releaseConfig);
    const overlayTitle = formatOverlayTitle(releaseConfig);
    applyDocumentTitle(releaseConfig);
    const library = PresetLibrary.fromConfig(treeConfig, continuityConfig);
    demo = new TreeDemo({
      canopySolidityProbe: new IsolatedCanopySolidityProbe(),
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
