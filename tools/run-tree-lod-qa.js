import { validateSceneConfig } from '../src/config/scene-config-validator.js';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import {
  analyzeTreeLodBudgets,
  evaluateTreeLodBudgets,
} from '../src/qa/tree-lod-budget-analyzer.js';
import { parseFoliageRepresentationPolicy } from '../src/rendering/foliage-representation-policy.js';
import { readYamlConfigSync } from './node-yaml-config.js';
import { parseTreeLodQaPolicy } from './tree-lod-qa-policy.js';

const treeConfig = readYamlConfigSync('config/tree-presets.yaml');
const continuityConfig = readYamlConfigSync('config/foliage-continuity.yaml');
const foliageRenderingPolicy = parseFoliageRepresentationPolicy(
  readYamlConfigSync('config/foliage-rendering.yaml'),
);
const sceneConfig = validateSceneConfig(readYamlConfigSync('config/scene.yaml'));
const presets = PresetLibrary.fromConfig(treeConfig, continuityConfig).presets;
const { budgets, sweep } = parseTreeLodQaPolicy(
  readYamlConfigSync('config/tree-lod-qa.yaml'),
);
const report = [];
const generator = new TreeGenerator();

function measure(presetId, seed, source) {
  const preset = presets.get(presetId);
  if (!preset) {
    throw new Error(`LOD QA references unknown preset '${presetId}'.`);
  }

  const tree = generator.generate(preset, seed);
  const metrics = analyzeTreeLodBudgets(tree, { foliageRenderingPolicy });
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
