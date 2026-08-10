import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { analyzeShellCoverage } from '../src/qa/shell-coverage-analyzer.js';
import { parseShellCoverageQaConfig } from '../src/qa/shell-coverage-qa-config.js';
import { evaluateShellCoverageQa } from '../src/qa/shell-coverage-qa-evaluator.js';
import { readYamlConfigSync } from './node-yaml-config.js';

const { values } = parseArgs({
  options: {
    seeds: { type: 'string' },
    output: { type: 'string' },
  },
});

const configuration = parseShellCoverageQaConfig(
  readYamlConfigSync('config/shell-coverage-qa.yaml'),
);
const treeConfig = readYamlConfigSync('config/tree-presets.yaml');
const continuityConfig = readYamlConfigSync('config/foliage-continuity.yaml');
const presets = PresetLibrary.fromConfig(
  treeConfig,
  continuityConfig,
).presets;
const seedCount = Number(values.seeds ?? configuration.run.seedCount);
if (!Number.isSafeInteger(seedCount) || seedCount <= 0) {
  throw new Error(
    `Invalid shell coverage seed count '${values.seeds ?? configuration.run.seedCount}'.`,
  );
}
const outputDirectory = path.resolve(
  values.output ?? 'qa-results/shell-coverage',
);
const generator = new TreeGenerator();

function summarize(values_) {
  const sorted = [...values_].sort((left, right) => left - right);
  const at = (ratio) =>
    sorted[Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio))];
  return {
    minimum: sorted[0],
    p50: at(0.5),
    p95: at(0.95),
    maximum: sorted.at(-1),
  };
}

const report = { schemaVersion: 3, presets: {}, passed: true, seedCount };

for (const [presetId, preset] of presets) {
  const thresholds = configuration.thresholds[presetId];

  if (!thresholds) {
    throw new Error(`Missing shell coverage thresholds for '${presetId}'.`);
  }

  const gapRatios = [];
  const gapCardRatios = [];
  const leafAreaIndices = [];
  const clusterCounts = [];
  const candidateCoverageRatios = [];
  const physicalCoverageRatios = [];
  const continuousTriangleCounts = [];
  const failures = [];
  let bareLobeTotal = 0;
  let continuousUncoveredTotal = 0;

  for (let index = 0; index < seedCount; index += 1) {
    const seed =
      (configuration.run.firstSeed +
        Math.imul(index, configuration.run.seedStep)) >>>
      0;
    const tree = generator.generate(preset, seed);
    const metrics = analyzeShellCoverage(tree, preset, configuration.probe);
    gapRatios.push(metrics.gapRatio);
    gapCardRatios.push(metrics.gapCardRatio);
    leafAreaIndices.push(metrics.leafAreaIndex);
    clusterCounts.push(metrics.clusterCount);
    candidateCoverageRatios.push(metrics.candidateCoverageRatio);
    physicalCoverageRatios.push(metrics.maximumPhysicalCoverageRatio);
    continuousTriangleCounts.push(metrics.continuous.trianglesVisited);
    bareLobeTotal += metrics.bareExposedLobes;
    continuousUncoveredTotal += metrics.continuous.uncoveredTriangleCount;

    const evaluation = evaluateShellCoverageQa(metrics, thresholds);
    if (!evaluation.passed) {
      failures.push({
        seed,
        failures: [...evaluation.failures],
        worst: metrics.worst,
        continuousWorst: metrics.continuous.worst,
      });
    }
  }

  const passed = failures.length === 0;
  report.passed = report.passed && passed;
  report.presets[presetId] = {
    passed,
    treesAnalyzed: seedCount,
    failedTreeCount: failures.length,
    bareExposedLobeTotal: bareLobeTotal,
    continuousUncoveredTriangleTotal: continuousUncoveredTotal,
    candidateCoverageRatio: summarize(candidateCoverageRatios),
    physicalCoverageRatio: summarize(physicalCoverageRatios),
    gapRatio: summarize(gapRatios),
    gapCardRatio: summarize(gapCardRatios),
    leafAreaIndex: summarize(leafAreaIndices),
    clusterCount: summarize(clusterCounts),
    continuousTrianglesVisited: summarize(continuousTriangleCounts),
    failures: failures.slice(0, configuration.report.maxFailures),
  };

  const summary = report.presets[presetId];
  console.log(
    `${presetId.padEnd(16)} ${passed ? 'PASS' : 'FAIL'} ` +
      `candidate max=${summary.candidateCoverageRatio.maximum.toFixed(3)} ` +
      `physical max=${summary.physicalCoverageRatio.maximum.toFixed(3)} ` +
      `gapCard max=${summary.gapCardRatio.maximum.toFixed(3)} ` +
      `leafArea min=${summary.leafAreaIndex.minimum.toFixed(2)} ` +
      `clusters p50=${summary.clusterCount.p50} ` +
      `continuous uncovered=${continuousUncoveredTotal} ` +
      `triangles p50=${summary.continuousTrianglesVisited.p50}`,
  );
  for (const failure of summary.failures) {
    console.log(`  seed ${failure.seed}: ${failure.failures.join('; ')}`);
  }
}

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, 'report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);

console.log(
  report.passed
    ? `Shell coverage QA PASSED: ${seedCount * presets.size} trees.`
    : 'Shell coverage QA FAILED.',
);
process.exitCode = report.passed ? 0 : 1;
