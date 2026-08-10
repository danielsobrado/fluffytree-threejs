import { validateSceneConfig } from '../src/config/scene-config-validator.js';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import {
  analyzeTreeLodBudgets,
  evaluateTreeLodBudgets,
} from '../src/qa/tree-lod-budget-analyzer.js';
import { readYamlConfigSync } from './node-yaml-config.js';

const MAXIMUM_SEED = 0xffffffff;
const LOD_COUNT = 4;

function requirePositiveInteger(value, path) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Configuration '${path}' must be a positive integer.`);
  }
  return value;
}

function requireUint32(value, path) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAXIMUM_SEED) {
    throw new Error(`Configuration '${path}' must be an unsigned 32-bit integer.`);
  }
  return value;
}

function requireBudgetArray(value, path) {
  if (!Array.isArray(value) || value.length !== LOD_COUNT) {
    throw new Error(`Configuration '${path}' must contain exactly ${LOD_COUNT} values.`);
  }
  return value.map((entry, index) =>
    requirePositiveInteger(entry, `${path}[${index}]`),
  );
}

function loadQaPolicy() {
  const config = readYamlConfigSync('config/tree-lod-qa.yaml');
  const budgets = config.budgets;
  const sweep = config.sweep;
  if (!budgets || typeof budgets !== 'object' || Array.isArray(budgets)) {
    throw new Error("Configuration 'tree-lod-qa.budgets' must be an object.");
  }
  if (!sweep || typeof sweep !== 'object' || Array.isArray(sweep)) {
    throw new Error("Configuration 'tree-lod-qa.sweep' must be an object.");
  }

  return Object.freeze({
    budgets: Object.freeze({
      maximumTriangles: Object.freeze(
        requireBudgetArray(budgets.maximumTriangles, 'tree-lod-qa.budgets.maximumTriangles'),
      ),
      maximumDrawCalls: Object.freeze(
        requireBudgetArray(budgets.maximumDrawCalls, 'tree-lod-qa.budgets.maximumDrawCalls'),
      ),
      maximumShadowTriangles: requirePositiveInteger(
        budgets.maximumShadowTriangles,
        'tree-lod-qa.budgets.maximumShadowTriangles',
      ),
    }),
    sweep: Object.freeze({
      seedCount: requirePositiveInteger(sweep.seedCount, 'tree-lod-qa.sweep.seedCount'),
      firstSeed: requireUint32(sweep.firstSeed, 'tree-lod-qa.sweep.firstSeed'),
      seedStep: requirePositiveInteger(sweep.seedStep, 'tree-lod-qa.sweep.seedStep'),
    }),
  });
}

const treeConfig = readYamlConfigSync('config/tree-presets.yaml');
const continuityConfig = readYamlConfigSync('config/foliage-continuity.yaml');
const sceneConfig = validateSceneConfig(readYamlConfigSync('config/scene.yaml'));
const presets = PresetLibrary.fromConfig(treeConfig, continuityConfig).presets;
const { budgets, sweep } = loadQaPolicy();
const report = [];
const generator = new TreeGenerator();

function measure(presetId, seed, source) {
  const preset = presets.get(presetId);
  if (!preset) {
    throw new Error(`LOD QA references unknown preset '${presetId}'.`);
  }

  const tree = generator.generate(preset, seed);
  const metrics = analyzeTreeLodBudgets(tree);
  const failures = evaluateTreeLodBudgets(metrics, budgets);
  report.push({ preset: presetId, seed, source, metrics, failures });
}

for (const entry of sceneConfig.layout) {
  measure(entry.preset, entry.seed, 'layout');
}

for (const presetId of presets.keys()) {
  for (let index = 0; index < sweep.seedCount; index += 1) {
    measure(
      presetId,
      (sweep.firstSeed + Math.imul(index, sweep.seedStep)) >>> 0,
      'sweep',
    );
  }
}

const failed = report.filter((entry) => entry.failures.length > 0);
const worstLod0 = Math.max(...report.map((entry) => entry.metrics.lodTriangles[0]));

console.log(
  JSON.stringify(
    {
      budgets,
      treesMeasured: report.length,
      worstLod0Triangles: worstLod0,
      failedTreeCount: failed.length,
      failures: failed.slice(0, 8),
      trees: report.filter((entry) => entry.source === 'layout'),
    },
    null,
    2,
  ),
);
if (failed.length > 0) process.exitCode = 1;
