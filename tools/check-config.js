import { readFileSync, readdirSync } from 'node:fs';
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
import { parseShellCoverageQaConfig } from '../src/qa/shell-coverage-qa-config.js';
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

const coverageConfig = parseShellCoverageQaConfig(
  readConfig('config/shell-coverage-qa.yaml'),
);
const presetIds = new Set(library.ids);
for (const presetId of presetIds) {
  if (!coverageConfig.thresholds[presetId]) {
    throw new Error(
      `Shell coverage QA is missing thresholds for tree preset '${presetId}'.`,
    );
  }
}
for (const presetId of Object.keys(coverageConfig.thresholds)) {
  if (!presetIds.has(presetId)) {
    throw new Error(
      `Shell coverage QA contains thresholds for unknown tree preset '${presetId}'.`,
    );
  }
}

parseTreeLodQaPolicy(readConfig('config/tree-lod-qa.yaml'));
parseTreeStressQaPolicy(readConfig('config/tree-stress-qa.yaml'));
parsePagesConfig(readConfig('pages.config.yml'));
console.log(
  `Validated ${configFiles.length} YAML config files, ${library.ids.length} tree presets, and ${sceneConfig.layout.length} scene entries.`,
);
