import {
  applyDocumentTitle,
  formatOverlayTitle,
  formatReleaseVersion,
} from './app/release-title.js';
import { TreeDemo } from './app/tree-demo.js';
import { YamlConfigLoader } from './config/yaml-config-loader.js';
import { logger } from './core/logger.js';
import { markRenderSmokeBootstrapFailure } from './diagnostics/render-smoke-probe.js';
import { PresetLibrary } from './domain/preset-library.js';
import { showFatalError } from './ui/demo-overlay.js';
import { createTuningPanel } from './ui/tuning-panel.js';

const CONFIG_URLS = Object.freeze({
  release: './config/release.yaml',
  scene: './config/scene.yaml',
  trees: './config/tree-presets.yaml',
});

async function bootstrap() {
  const container = document.querySelector('#app');

  if (!container) {
    throw new Error("Required application container '#app' was not found.");
  }

  try {
    const loader = new YamlConfigLoader();
    const [releaseConfig, sceneConfig, treeConfig] = await Promise.all([
      loader.load(CONFIG_URLS.release),
      loader.load(CONFIG_URLS.scene),
      loader.load(CONFIG_URLS.trees),
    ]);
    const releaseVersion = formatReleaseVersion(releaseConfig);
    const overlayTitle = formatOverlayTitle(releaseConfig);
    applyDocumentTitle(releaseConfig);
    const library = PresetLibrary.fromConfig(treeConfig);
    const demo = new TreeDemo();
    demo.start(
      container,
      sceneConfig,
      library,
      releaseVersion,
      overlayTitle,
    );

    // The QA modes drive the same page. A studio panel over the canvas would
    // change what every screenshot gate measures, so it stays out of them.
    if (!new URLSearchParams(window.location.search).has('qa')) {
      createTuningPanel(container, demo, library);
    }
  } catch (error) {
    logger.error('Application bootstrap failed.', error);
    markRenderSmokeBootstrapFailure(error);
    showFatalError(container, error);
  }
}

bootstrap();
