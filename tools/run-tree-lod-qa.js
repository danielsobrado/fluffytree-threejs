import fs from 'node:fs';
import { load } from 'js-yaml';
import { createTreePresetMap } from '../src/domain/tree-preset.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import {
  analyzeTreeLodBudgets,
  evaluateTreeLodBudgets,
} from '../src/qa/tree-lod-budget-analyzer.js';

const treeConfig = load(fs.readFileSync('config/tree-presets.yaml', 'utf8'));
const sceneConfig = load(fs.readFileSync('config/scene.yaml', 'utf8'));
const presets = createTreePresetMap(treeConfig);
const budgets = {
  maximumTriangles: [25000, 8000, 2000, 2],
  maximumDrawCalls: [5, 4, 2, 1],
  maximumShadowTriangles: 2000,
};
// Cluster counts follow from covering the crown surface rather than from a fixed
// per-lobe quota, so they vary with the seed. Every preset is therefore measured
// across a seed sweep as well as at the seeds the demo layout ships with.
const SWEEP_SEED_COUNT = 24;
const SWEEP_FIRST_SEED = 90001;
const SWEEP_SEED_STEP = 7919;
const report = [];

function measure(presetId, seed, source) {
  const preset = presets.get(presetId);
  const tree = new TreeGenerator().generate(preset, seed);
  const metrics = analyzeTreeLodBudgets(tree);
  const failures = evaluateTreeLodBudgets(metrics, budgets);
  report.push({ preset: presetId, seed, source, metrics, failures });
}

for (const entry of sceneConfig.layout) {
  measure(entry.preset, entry.seed, 'layout');
}

for (const presetId of presets.keys()) {
  for (let index = 0; index < SWEEP_SEED_COUNT; index += 1) {
    measure(
      presetId,
      (SWEEP_FIRST_SEED + Math.imul(index, SWEEP_SEED_STEP)) >>> 0,
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
