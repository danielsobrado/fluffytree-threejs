import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatOverlayTitle,
  formatReleaseVersion,
} from '../src/app/release-title.js';
import { parseTreeAnimationPolicy } from '../src/animation/tree-animation-policy-config.js';
import { parseTreeQualityProfiles } from '../src/compilation/tree-quality-profile-config.js';
import { validateSceneConfig } from '../src/config/scene-config-validator.js';
import { parseTreeShowcaseLayout } from '../src/config/tree-showcase-layout-config.js';
import {
  FOLIAGE_CONTINUITY_PROFILE_IDS,
  resolveFoliageContinuityProfile,
} from '../src/domain/foliage-continuity-config.js';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { parseForestRuntimePolicy } from '../src/forest/forest-runtime-policy.js';
import { parseForestVariantPolicy } from '../src/forest/forest-variant-policy.js';
import { parseWhorledConiferConfig } from '../src/generation/whorled-conifer-config.js';
import { parseCanopySolidityQaConfig } from '../src/qa/canopy-solidity-qa-config.js';
import { parseCrownVolumeQaConfig } from '../src/qa/crown-volume-qa-config.js';
import { parseNativeTreeQaConfig } from '../src/qa/native-tree-qa-config.js';
import { parseShellCoverageQaConfig } from '../src/qa/shell-coverage-qa-config.js';
import { parseStemManifoldQaConfig } from '../src/qa/stem-manifold-qa-config.js';
import { parseTreeShapeQaConfig } from '../src/qa/tree-shape-qa-config.js';
import { parseTreeStressQaPolicy } from '../src/qa/tree-stress-qa-policy.js';
import { parseFoliageRepresentationPolicy } from '../src/rendering/foliage-representation-policy.js';
import { validateTreeIrRenderBudgets } from '../src/rendering/tree-ir-render-budget-validator.js';
import { parseTreeIrRenderingConfig } from '../src/rendering/tree-ir-rendering-config.js';
import { parseTreeGenerationRuntimePolicy } from '../src/workers/tree-generation-runtime-policy.js';
import { readYamlConfigSync } from './node-yaml-config.js';
import { parsePagesConfig } from './pages-config.js';
import { assertReleaseSourceConsistency } from './release-source-check.js';
import { parseTreeLodQaPolicy } from './tree-lod-qa-policy.js';

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const CONFIG_DIRECTORY = path.join(REPOSITORY_ROOT, 'config');
const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);

function readConfig(relativePath) {
  return readYamlConfigSync(path.join(REPOSITORY_ROOT, relativePath));
}

function readText(relativePath) {
  return readFileSync(path.join(REPOSITORY_ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    throw new Error(`Failed to parse JSON file '${relativePath}'.`, {
      cause: error,
    });
  }
}

function assertRequiredFilesExist(requiredFiles) {
  for (const relativePath of requiredFiles) {
    const absolutePath = path.join(REPOSITORY_ROOT, relativePath);

    try {
      if (!statSync(absolutePath).isFile()) {
        throw new Error('Path is not a file.');
      }
    } catch (error) {
      throw new Error(
        `Pages required file '${relativePath}' does not exist as a file.`,
        { cause: error },
      );
    }
  }
}

function assertExactPresetCoverage(label, configuredIds, presetIds) {
  for (const presetId of presetIds) {
    if (!configuredIds.has(presetId)) {
      throw new Error(`${label} is missing thresholds for tree preset '${presetId}'.`);
    }
  }
  for (const presetId of configuredIds) {
    if (!presetIds.has(presetId)) {
      throw new Error(`${label} contains thresholds for unknown tree preset '${presetId}'.`);
    }
  }
}

const configFiles = readdirSync(CONFIG_DIRECTORY, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() && YAML_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
  )
  .map((entry) => `config/${entry.name}`)
  .sort();

for (const file of configFiles) readConfig(file);

const releaseConfig = readConfig('config/release.yaml');
formatReleaseVersion(releaseConfig);
formatOverlayTitle(releaseConfig);
assertReleaseSourceConsistency({
  release: releaseConfig,
  packageConfig: readJson('package.json'),
  indexHtml: readText('index.html'),
});

const sceneConfig = validateSceneConfig(readConfig('config/scene.yaml'));
const continuityConfig = readConfig('config/foliage-continuity.yaml');
for (const profile of FOLIAGE_CONTINUITY_PROFILE_IDS) {
  resolveFoliageContinuityProfile(continuityConfig, profile);
}
parseFoliageRepresentationPolicy(readConfig('config/foliage-rendering.yaml'));

const treePresetConfig = readConfig('config/tree-presets.yaml');
const coniferPresetConfig = readConfig('config/conifer-presets.yaml');
const palmPresetConfig = readConfig('config/palm-presets.yaml');
const advancedBroadleafPresetConfig = readConfig(
  'config/advanced-broadleaf-presets.yaml',
);
const library = PresetLibrary.fromConfig(treePresetConfig, continuityConfig);
const speciesLibrary = PresetLibrary.fromConfigs(
  [
    treePresetConfig,
    coniferPresetConfig,
    palmPresetConfig,
    advancedBroadleafPresetConfig,
  ],
  continuityConfig,
);
const coniferLibrary = PresetLibrary.fromConfig(
  coniferPresetConfig,
  continuityConfig,
);
for (const preset of coniferLibrary.presets.values()) {
  parseWhorledConiferConfig(preset);
}

const qualityProfiles = parseTreeQualityProfiles(
  readConfig('config/tree-quality-profiles.yaml'),
);
const treeIrRenderingConfig = parseTreeIrRenderingConfig(
  readConfig('config/tree-ir-rendering.yaml'),
);
for (const qualityProfile of Object.values(qualityProfiles)) {
  validateTreeIrRenderBudgets(qualityProfile, treeIrRenderingConfig);
}
parseForestVariantPolicy(readConfig('config/forest-variant-policy.yaml'));
parseForestRuntimePolicy(readConfig('config/forest-runtime-policy.yaml'));
parseTreeGenerationRuntimePolicy(readConfig('config/tree-generation-runtime.yaml'));
parseTreeAnimationPolicy(readConfig('config/tree-animation-policy.yaml'));
parseNativeTreeQaConfig(readConfig('config/native-tree-qa.yaml'));
const showcaseLayout = parseTreeShowcaseLayout(
  readConfig('config/universal-showcase-layout.yaml'),
);
for (const entry of showcaseLayout) {
  if (!speciesLibrary.has(entry.preset)) {
    throw new Error(
      `Universal showcase layout references unknown tree preset '${entry.preset}'.`,
    );
  }
}

for (const entry of sceneConfig.layout) {
  if (!library.has(entry.preset)) {
    throw new Error(`Scene layout references unknown tree preset '${entry.preset}'.`);
  }
}

const presetIds = new Set(library.ids);
const coverageConfig = parseShellCoverageQaConfig(
  readConfig('config/shell-coverage-qa.yaml'),
);
assertExactPresetCoverage(
  'Shell coverage QA',
  new Set(Object.keys(coverageConfig.thresholds)),
  presetIds,
);

const solidityConfig = parseCanopySolidityQaConfig(
  readConfig('config/canopy-solidity-qa.yaml'),
);
assertExactPresetCoverage(
  'Canopy solidity QA',
  new Set(Object.keys(solidityConfig.thresholds)),
  presetIds,
);

const treeShapeConfig = parseTreeShapeQaConfig(
  readConfig('config/tree-shape-qa.yaml'),
);
for (const presetId of Object.keys(treeShapeConfig.thresholds.presets)) {
  if (!presetIds.has(presetId)) {
    throw new Error(
      `Tree shape QA contains an override for unknown tree preset '${presetId}'.`,
    );
  }
}

parseCrownVolumeQaConfig(readConfig('config/crown-volume-qa.yaml'));
parseStemManifoldQaConfig(readConfig('config/stem-manifold-qa.yaml'));
parseTreeLodQaPolicy(readConfig('config/tree-lod-qa.yaml'));
parseTreeStressQaPolicy(readConfig('config/tree-stress-qa.yaml'));
const pagesConfig = parsePagesConfig(readConfig('pages.config.yml'));
assertRequiredFilesExist(pagesConfig.requiredFiles);
console.log(
  `Validated ${configFiles.length} YAML config files, ${speciesLibrary.ids.length} species presets (${library.ids.length} demo presets), ${sceneConfig.layout.length} scene entries, ${showcaseLayout.length} showcase entries, and ${pagesConfig.requiredFiles.length} Pages files.`,
);
