import { TreeDemo } from './app/tree-demo.js';
import { YamlConfigLoader } from './config/yaml-config-loader.js';
import { logger } from './core/logger.js';
import { markRenderSmokeBootstrapFailure } from './diagnostics/render-smoke-probe.js';
import { createTreePresetMap } from './domain/tree-preset.js';
import { showFatalError } from './ui/demo-overlay.js';

const CONFIG_URLS = Object.freeze({
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
    const [sceneConfig, treeConfig] = await Promise.all([
      loader.load(CONFIG_URLS.scene),
      loader.load(CONFIG_URLS.trees),
    ]);
    const presetMap = createTreePresetMap(treeConfig);
    const demo = new TreeDemo();
    demo.start(container, sceneConfig, presetMap);
  } catch (error) {
    logger.error('Application bootstrap failed.', error);
    markRenderSmokeBootstrapFailure(error);
    showFatalError(container, error);
  }
}

bootstrap();
