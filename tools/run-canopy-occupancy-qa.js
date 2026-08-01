import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { load } from 'js-yaml';
import { createTreePresetMap } from '../src/domain/tree-preset.js';
import { CanopyOccupancyQaRunner } from '../src/qa/canopy-occupancy-qa-runner.js';

const FILES = Object.freeze({
  presets: new URL('../config/tree-presets.yaml', import.meta.url),
  qa: new URL('../config/canopy-occupancy-qa.yaml', import.meta.url),
});

async function loadYaml(url) {
  const value = load(await readFile(url, 'utf8'));
  if (!value || typeof value !== 'object') {
    throw new Error(`Configuration '${url.pathname}' did not contain an object.`);
  }
  return value;
}

function readOptions() {
  const { values } = parseArgs({
    options: {
      seeds: { type: 'string' },
      output: { type: 'string', default: 'qa-results/canopy-occupancy' },
    },
  });

  if (values.seeds === undefined) return values;
  const seedCount = Number(values.seeds);
  if (!Number.isSafeInteger(seedCount) || seedCount <= 0) {
    throw new Error(`Invalid seed count '${values.seeds}'.`);
  }
  return { ...values, seedCount };
}

function renderMarkdown(report) {
  const lines = [
    '# Canopy occupancy QA',
    '',
    `Result: **${report.passed ? 'PASS' : 'FAIL'}**`,
    '',
    `Trees analyzed: ${report.summary.treesAnalyzed}`,
    `Failed trees: ${report.summary.failedTreeCount}`,
    '',
    '| Preset | Result | Coverage min | Slice min | Trunk min | Cap min |',
    '|---|---:|---:|---:|---:|---:|',
  ];

  for (const [presetId, preset] of Object.entries(report.presets)) {
    lines.push(
      `| ${presetId} | ${preset.passed ? 'PASS' : 'FAIL'} | ${preset.metrics.coverageRatio.minimum.toFixed(4)} | ${preset.metrics.minimumSliceCoverage.minimum.toFixed(4)} | ${preset.metrics.trunkCoverageRatio.minimum.toFixed(4)} | ${preset.metrics.capCoverageRatio.minimum.toFixed(4)} |`,
    );
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = readOptions();
  const [presetConfiguration, sourceQaConfiguration] = await Promise.all([
    loadYaml(FILES.presets),
    loadYaml(FILES.qa),
  ]);
  const qaConfiguration = structuredClone(sourceQaConfiguration);
  if (options.seedCount !== undefined) {
    qaConfiguration.run.seedCount = options.seedCount;
  }

  const report = new CanopyOccupancyQaRunner().run(
    createTreePresetMap(presetConfiguration),
    qaConfiguration,
  );
  await mkdir(options.output, { recursive: true });
  await Promise.all([
    writeFile(
      `${options.output}/report.json`,
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    ),
    writeFile(`${options.output}/report.md`, renderMarkdown(report), 'utf8'),
  ]);

  console.log(
    `Canopy occupancy QA ${report.passed ? 'PASSED' : 'FAILED'}: ${report.summary.treesAnalyzed} trees, ${report.summary.failedTreeCount} failures.`,
  );
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error('Canopy occupancy QA failed to execute.', error);
  process.exitCode = 1;
});
