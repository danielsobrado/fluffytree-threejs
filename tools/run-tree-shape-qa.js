import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { load } from 'js-yaml';
import { createTreePresetMap } from '../src/domain/tree-preset.js';
import { renderQaMarkdown } from '../src/qa/qa-report-renderer.js';
import { TreeShapeQaRunner } from '../src/qa/tree-shape-qa-runner.js';

const FILES = Object.freeze({
  presets: new URL('../config/tree-presets.yaml', import.meta.url),
  qa: new URL('../config/tree-shape-qa.yaml', import.meta.url),
});

async function loadYaml(url) {
  const content = await readFile(url, 'utf8');
  const value = load(content);

  if (!value || typeof value !== 'object') {
    throw new Error(
      `Configuration '${url.pathname}' did not contain an object.`,
    );
  }

  return value;
}

function readOptions() {
  const { values } = parseArgs({
    options: {
      seeds: { type: 'string' },
      output: { type: 'string', default: 'qa-results/tree-shape' },
    },
  });

  if (values.seeds === undefined) return values;
  const seedCount = Number(values.seeds);

  if (!Number.isSafeInteger(seedCount) || seedCount <= 0) {
    throw new Error(`Invalid seed count '${values.seeds}'.`);
  }

  return { ...values, seedCount };
}

function printSummary(report) {
  console.log(
    `Tree shape QA ${report.passed ? 'PASSED' : 'FAILED'}: ${report.summary.treesAnalyzed} trees, ${report.summary.failedTreeCount} failures.`,
  );

  for (const [presetId, preset] of Object.entries(report.presets)) {
    console.log(
      `${presetId}: ${preset.passed ? 'PASS' : 'FAIL'}, unique ${preset.uniqueTreeCount}/${preset.treesAnalyzed}, aspect p50 ${preset.metrics.crownAspectRatio.p50}, fill p50 ${preset.metrics.silhouetteFillRatio.p50}.`,
    );
  }
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

  const report = new TreeShapeQaRunner().run(
    createTreePresetMap(presetConfiguration),
    qaConfiguration,
  );
  const outputDirectory = options.output;
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      `${outputDirectory}/report.json`,
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      `${outputDirectory}/report.md`,
      renderQaMarkdown(report, qaConfiguration.report.summaryMetrics),
      'utf8',
    ),
  ]);

  printSummary(report);
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error('Tree shape QA failed to execute.', error);
  process.exitCode = 1;
});
