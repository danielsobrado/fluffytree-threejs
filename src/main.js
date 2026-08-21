import {
  applyDocumentTitle,
  formatOverlayTitle,
  formatReleaseVersion,
} from './app/release-title.js?v=2.0.0-20260814.2';
import { TreeDemo } from './app/tree-demo.js?v=2.0.0-20260814.2';
import { validateSceneConfig } from './config/scene-config-validator.js?v=2.0.0-20260814.2';
import { YamlConfigLoader } from './config/yaml-config-loader.js?v=2.0.0-20260814.2';
import { logger } from './core/logger.js?v=2.0.0-20260814.2';
import { IsolatedCanopySolidityProbe } from './diagnostics/isolated-canopy-solidity-probe.js?v=2.0.0-20260814.2';
import { markRenderSmokeBootstrapFailure } from './diagnostics/render-smoke-probe.js?v=2.0.0-20260814.2';
import {
  markStemManifoldBootstrapFailure,
  StemManifoldProbe,
} from './diagnostics/stem-manifold-probe.js?v=2.0.0-20260814.2';
import { PresetLibrary } from './domain/preset-library.js?v=2.0.0-20260814.2';
import { parseShellCoverageQaConfig } from './qa/shell-coverage-qa-config.js?v=2.0.0-20260814.2';
import { parseTreeStressQaPolicy } from './qa/tree-stress-qa-policy.js?v=2.0.0-20260814.2';
import { showFatalError } from './ui/demo-overlay.js?v=2.0.0-20260814.2';
import { createSceneMenu } from './ui/scene-menu.js?v=2.0.0-20260814.2';
import { createTuningPanel } from './ui/tuning-panel.js?v=2.0.0-20260814.2';

const CONFIG_URLS = Object.freeze({
  release: './config/release.yaml',
  scene: './config/scene.yaml',
  trees: './config/tree-presets.yaml',
  foliageContinuity: './config/foliage-continuity.yaml',
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
      rawCoverageConfig,
      rawStressConfig,
    ] = await Promise.all([
      loader.load(CONFIG_URLS.release),
      loader.load(CONFIG_URLS.scene),
      loader.load(CONFIG_URLS.trees),
      loader.load(CONFIG_URLS.foliageContinuity),
      loader.load(CONFIG_URLS.shellCoverageQa),
      loader.load(CONFIG_URLS.treeStressQa),
    ]);
    const sceneConfig = validateSceneConfig(rawSceneConfig);
    const coverageConfig = parseShellCoverageQaConfig(rawCoverageConfig);
    const stressPolicy = parseTreeStressQaPolicy(rawStressConfig);
    const releaseVersion = formatReleaseVersion(releaseConfig);
    const overlayTitle = formatOverlayTitle(releaseConfig);
    applyDocumentTitle(releaseConfig);
    const library = PresetLibrary.fromConfig(treeConfig, continuityConfig);
    demo = new TreeDemo({
      canopySolidityProbe: new IsolatedCanopySolidityProbe(),
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
