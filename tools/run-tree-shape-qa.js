import { mkdir, rm, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { renderQaMarkdown } from '../src/qa/qa-report-renderer.js';
import { parseTreeShapeQaConfig } from '../src/qa/tree-shape-qa-config.js';
import { TreeShapeQaRunner } from '../src/qa/tree-shape-qa-runner.js';
import { readYamlConfig } from './node-yaml-config.js';

const FILES = Object.freeze({
  presets: new URL('../config/tree-presets.yaml', import.meta.url),
  continuity: new URL('../config/foliage-continuity.yaml', import.meta.url),
  qa: new URL('../config/tree-shape-qa.yaml', import.meta.url),
});
const REPORT_FILES = Object.freeze(['report.json', 'report.md']);

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

async function clearPreviousReports(outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(
    REPORT_FILES.map((file) => rm(`${outputDirectory}/${file}`, { force: true })),
  );
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
  await clearPreviousReports(options.output);
  const [presetConfiguration, continuityConfiguration, sourceQaConfiguration] =
    await Promise.all([
      readYamlConfig(FILES.presets),
      readYamlConfig(FILES.continuity),
      readYamlConfig(FILES.qa),
    ]);
  const qaConfiguration = structuredClone(sourceQaConfiguration);

  if (options.seedCount !== undefined) {
    qaConfiguration.run.seedCount = options.seedCount;
  }

  const validatedQaConfiguration = parseTreeShapeQaConfig(qaConfiguration);
  const presets = PresetLibrary.fromConfig(
    presetConfiguration,
    continuityConfiguration,
  ).presets;
  const report = new TreeShapeQaRunner().run(
    presets,
    validatedQaConfiguration,
  );
  const outputDirectory = options.output;
  await Promise.all([
    writeFile(
      `${outputDirectory}/report.json`,
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      `${outputDirectory}/report.md`,
      renderQaMarkdown(report, validatedQaConfiguration.report.summaryMetrics),
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
