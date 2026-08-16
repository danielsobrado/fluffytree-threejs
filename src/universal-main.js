import { UniversalTreeShowcase } from './app/universal-tree-showcase.js';
import { parseTreeQualityProfiles } from './compilation/tree-quality-profile-config.js';
import { validateSceneConfig } from './config/scene-config-validator.js';
import { parseTreeShowcaseLayout } from './config/tree-showcase-layout-config.js';
import { YamlConfigLoader } from './config/yaml-config-loader.js';
import { logger } from './core/logger.js';
import { markNativeRenderSmokeBootstrapFailure } from './diagnostics/native-render-smoke-probe.js';
import { PresetLibrary } from './domain/preset-library.js';
import { TreeGenerator } from './generation/tree-generator.js';
import { SceneFactory } from './rendering/scene-factory.js';
import { TreeIrMeshBuilder } from './rendering/tree-ir-mesh-builder.js';
import { parseTreeIrRenderingConfig } from './rendering/tree-ir-rendering-config.js';
import { UniversalTreeMeshBuilder } from './rendering/universal-tree-mesh-builder.js';
import { showFatalError } from './ui/demo-overlay.js';

const CONFIG_URLS = Object.freeze({
  scene: './config/scene.yaml',
  layout: './config/universal-showcase-layout.yaml',
  palms: './config/palm-presets.yaml',
  broadleaf: './config/advanced-broadleaf-presets.yaml',
  quality: './config/tree-quality-profiles.yaml',
  directRendering: './config/tree-ir-rendering.yaml',
});

function assertLayoutPresets(library, layout) {
  for (const entry of layout) {
    if (!library.has(entry.preset)) {
      throw new Error(`Showcase references unknown tree preset '${entry.preset}'.`);
    }
  }
}

async function bootstrap() {
  const container = document.querySelector('#app');
  let showcase = null;

  try {
    if (!container) {
      throw new Error("Required application container '#app' was not found.");
    }
    const loader = new YamlConfigLoader();
    const [
      rawScene,
      rawLayout,
      palmConfig,
      broadleafConfig,
      rawQuality,
      rawDirectRendering,
    ] = await Promise.all([
      loader.load(CONFIG_URLS.scene),
      loader.load(CONFIG_URLS.layout),
      loader.load(CONFIG_URLS.palms),
      loader.load(CONFIG_URLS.broadleaf),
      loader.load(CONFIG_URLS.quality),
      loader.load(CONFIG_URLS.directRendering),
    ]);
    const sceneConfig = validateSceneConfig(rawScene);
    const layout = parseTreeShowcaseLayout(rawLayout);
    const library = PresetLibrary.fromConfigs([palmConfig, broadleafConfig]);
    const qualityProfile = parseTreeQualityProfiles(rawQuality).default;
    const renderingConfig = parseTreeIrRenderingConfig(rawDirectRendering);
    assertLayoutPresets(library, layout);

    const directBuilder = new TreeIrMeshBuilder({
      qualityProfile,
      renderingConfig,
    });
    const treeMeshBuilder = new UniversalTreeMeshBuilder({ directBuilder });
    showcase = new UniversalTreeShowcase({
      sceneFactory: new SceneFactory(),
      treeGenerator: new TreeGenerator(),
      treeMeshBuilder,
    });
    showcase.start(container, sceneConfig, library, layout);
  } catch (error) {
    showcase?.destroy();
    markNativeRenderSmokeBootstrapFailure(error);
    logger.error('Universal Tree IR showcase bootstrap failed.', error);
    if (container) showFatalError(container, error);
  }
}

void bootstrap();
