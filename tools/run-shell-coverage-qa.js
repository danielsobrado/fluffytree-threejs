import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { load } from 'js-yaml';
import { createTreePresetMap } from '../src/domain/tree-preset.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { analyzeShellCoverage } from '../src/qa/shell-coverage-analyzer.js';

const { values } = parseArgs({
  options: {
    seeds: { type: 'string' },
    output: { type: 'string' },
  },
});

const configuration = load(
  fs.readFileSync('config/shell-coverage-qa.yaml', 'utf8'),
);
const presets = createTreePresetMap(
  load(fs.readFileSync('config/tree-presets.yaml', 'utf8')),
);
const seedCount = Number(values.seeds ?? configuration.run.seedCount);
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

const report = { presets: {}, passed: true, seedCount };

for (const [presetId, preset] of presets) {
  const thresholds = configuration.thresholds[presetId];

  if (!thresholds) {
    throw new Error(`Missing shell coverage thresholds for '${presetId}'.`);
  }

  const gapRatios = [];
  const gapCardRatios = [];
  const clusterCounts = [];
  const failures = [];
  let bareLobeTotal = 0;

  for (let index = 0; index < seedCount; index += 1) {
    const seed =
      (Number(configuration.run.firstSeed) +
        Math.imul(index, Number(configuration.run.seedStep))) >>>
      0;
    const tree = generator.generate(preset, seed);
    const metrics = analyzeShellCoverage(tree, preset, configuration.probe);
    gapRatios.push(metrics.gapRatio);
    gapCardRatios.push(metrics.gapCardRatio);
    clusterCounts.push(metrics.clusterCount);
    bareLobeTotal += metrics.bareExposedLobes;

    const seedFailures = [];
    if (metrics.gapRatio > thresholds.gapRatio) {
      seedFailures.push(
        `gapRatio ${metrics.gapRatio.toFixed(4)} > ${thresholds.gapRatio}`,
      );
    }
    if (metrics.gapCardRatio > thresholds.gapCardRatio) {
      seedFailures.push(
        `gapCardRatio ${metrics.gapCardRatio.toFixed(4)} > ${thresholds.gapCardRatio}`,
      );
    }
    if (metrics.bareExposedLobes > thresholds.bareExposedLobes) {
      seedFailures.push(
        `bareExposedLobes ${metrics.bareExposedLobes} > ${thresholds.bareExposedLobes}`,
      );
    }
    if (seedFailures.length > 0) {
      failures.push({ seed, failures: seedFailures, worst: metrics.worst });
    }
  }

  const passed = failures.length === 0;
  report.passed = report.passed && passed;
  report.presets[presetId] = {
    passed,
    treesAnalyzed: seedCount,
    failedTreeCount: failures.length,
    bareExposedLobeTotal: bareLobeTotal,
    gapRatio: summarize(gapRatios),
    gapCardRatio: summarize(gapCardRatios),
    clusterCount: summarize(clusterCounts),
    failures: failures.slice(0, configuration.report.maxFailures),
  };

  const summary = report.presets[presetId];
  console.log(
    `${presetId.padEnd(16)} ${passed ? 'PASS' : 'FAIL'} ` +
      `gapRatio max=${summary.gapRatio.maximum.toFixed(3)} ` +
      `gapCardRatio max=${summary.gapCardRatio.maximum.toFixed(3)} ` +
      `clusters p50=${summary.clusterCount.p50} max=${summary.clusterCount.maximum} ` +
      `bareLobes=${bareLobeTotal}`,
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
