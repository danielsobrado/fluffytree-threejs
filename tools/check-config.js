import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatOverlayTitle,
  formatReleaseVersion,
} from '../src/app/release-title.js';
import { validateSceneConfig } from '../src/config/scene-config-validator.js';
import {
  FOLIAGE_CONTINUITY_PROFILE_IDS,
  resolveFoliageContinuityProfile,
} from '../src/domain/foliage-continuity-config.js';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { parseCanopySolidityQaConfig } from '../src/qa/canopy-solidity-qa-config.js';
import { parseCrownVolumeQaConfig } from '../src/qa/crown-volume-qa-config.js';
import { parseShellCoverageQaConfig } from '../src/qa/shell-coverage-qa-config.js';
import { parseStemManifoldQaConfig } from '../src/qa/stem-manifold-qa-config.js';
import { parseTreeShapeQaConfig } from '../src/qa/tree-shape-qa-config.js';
import { parseTreeStressQaPolicy } from '../src/qa/tree-stress-qa-policy.js';
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

const library = PresetLibrary.fromConfig(
  readConfig('config/tree-presets.yaml'),
  continuityConfig,
);
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
  `Validated ${configFiles.length} YAML config files, ${library.ids.length} tree presets, ${sceneConfig.layout.length} scene entries, and ${pagesConfig.requiredFiles.length} Pages files.`,
);
