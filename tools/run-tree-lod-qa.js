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
const report = [];

for (const entry of sceneConfig.layout) {
  const preset = presets.get(entry.preset);
  const tree = new TreeGenerator().generate(preset, entry.seed);
  const metrics = analyzeTreeLodBudgets(tree);
  const failures = evaluateTreeLodBudgets(metrics, budgets);
  report.push({ preset: entry.preset, seed: entry.seed, metrics, failures });
}

console.log(JSON.stringify({ budgets, trees: report }, null, 2));
if (report.some((entry) => entry.failures.length > 0)) process.exitCode = 1;
