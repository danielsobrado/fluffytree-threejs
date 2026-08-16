import { PresetLibrary } from '../src/domain/preset-library.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { validateTreeIr } from '../src/generation/tree-ir-validator.js';
import { parseNativeTreeQaConfig } from '../src/qa/native-tree-qa-config.js';
import { readYamlConfigSync } from './node-yaml-config.js';

const SEED_PRESET_STEP = 8191;
const SEED_SAMPLE_STEP = 104729;

function extent(bounds, axis) {
  return bounds.maximum[axis] - bounds.minimum[axis];
}

function assertWithin(value, maximum, message) {
  if (value > maximum) throw new Error(`${message}: ${value} > ${maximum}.`);
}

function assertAtLeast(value, minimum, message) {
  if (value < minimum) throw new Error(`${message}: ${value} < ${minimum}.`);
}

function assertDeterministic(first, second, presetId, seed) {
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error(
      `Native Tree IR '${presetId}' is not deterministic for seed ${seed}.`,
    );
  }
}

const policy = parseNativeTreeQaConfig(
  readYamlConfigSync(new URL('../config/native-tree-qa.yaml', import.meta.url)),
);
const library = PresetLibrary.fromConfigs([
  readYamlConfigSync(new URL('../config/palm-presets.yaml', import.meta.url)),
  readYamlConfigSync(
    new URL('../config/advanced-broadleaf-presets.yaml', import.meta.url),
  ),
]);
const generator = new TreeGenerator();
let generatedCount = 0;

for (const [presetIndex, presetId] of library.ids.entries()) {
  const preset = library.get(presetId);
  for (let sample = 0; sample < policy.seedsPerPreset; sample += 1) {
    const seed =
      (policy.baseSeed +
        Math.imul(presetIndex, SEED_PRESET_STEP) +
        Math.imul(sample, SEED_SAMPLE_STEP)) >>>
      0;
    const first = generator.generateIr(preset, seed);
    const second = generator.generateIr(preset, seed);
    validateTreeIr(first);
    assertDeterministic(first, second, presetId, seed);
    assertWithin(
      first.stems.length,
      policy.maximumStemCount,
      `Native Tree IR '${presetId}' exceeded the stem cap`,
    );
    assertWithin(
      first.foliageSites.length,
      policy.maximumFoliageSiteCount,
      `Native Tree IR '${presetId}' exceeded the foliage-site cap`,
    );
    const width = extent(first.bounds, 'x');
    const depth = extent(first.bounds, 'z');
    const vertical = extent(first.bounds, 'y');
    assertAtLeast(
      Math.max(width, depth),
      policy.minimumBoundsExtent,
      `Native Tree IR '${presetId}' has collapsed horizontal bounds`,
    );
    assertAtLeast(
      vertical,
      policy.minimumBoundsExtent,
      `Native Tree IR '${presetId}' has collapsed vertical bounds`,
    );
    assertWithin(
      Math.max(width, depth) / first.height,
      policy.maximumHorizontalSpanRatio,
      `Native Tree IR '${presetId}' exceeded horizontal span ratio`,
    );
    assertWithin(
      vertical / first.height,
      policy.maximumVerticalSpanRatio,
      `Native Tree IR '${presetId}' exceeded vertical span ratio`,
    );
    generatedCount += 1;
  }
}

console.log(
  `Native Tree IR QA passed ${generatedCount} deterministic generations across ${library.ids.length} presets.`,
);
