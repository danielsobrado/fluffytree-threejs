import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
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
import { parsePagesConfig } from './pages-config.js';

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const CONFIG_DIRECTORY = path.join(REPOSITORY_ROOT, 'config');
const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);

function readYaml(relativePath) {
  const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
  let document;

  try {
    document = yaml.load(readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse YAML configuration '${relativePath}'.`, {
      cause: error,
    });
  }

  if (document === null || document === undefined) {
    throw new Error(`YAML configuration '${relativePath}' must not be empty.`);
  }

  return document;
}

const configFiles = readdirSync(CONFIG_DIRECTORY, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() && YAML_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
  )
  .map((entry) => `config/${entry.name}`)
  .sort();

for (const file of configFiles) readYaml(file);

const releaseConfig = readYaml('config/release.yaml');
formatReleaseVersion(releaseConfig);
formatOverlayTitle(releaseConfig);

const sceneConfig = validateSceneConfig(readYaml('config/scene.yaml'));
const continuityConfig = readYaml('config/foliage-continuity.yaml');
for (const profile of FOLIAGE_CONTINUITY_PROFILE_IDS) {
  resolveFoliageContinuityProfile(continuityConfig, profile);
}

const library = PresetLibrary.fromConfig(
  readYaml('config/tree-presets.yaml'),
  continuityConfig,
);
for (const entry of sceneConfig.layout) {
  if (!library.has(entry.preset)) {
    throw new Error(`Scene layout references unknown tree preset '${entry.preset}'.`);
  }
}

parsePagesConfig(readYaml('pages.config.yml'));
console.log(
  `Validated ${configFiles.length} YAML config files, ${library.ids.length} tree presets, and ${sceneConfig.layout.length} scene entries.`,
);
