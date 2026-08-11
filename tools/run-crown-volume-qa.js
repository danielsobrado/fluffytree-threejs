import { mkdir, rm, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { parseCrownVolumeQaConfig } from '../src/qa/crown-volume-qa-config.js';
import { CrownVolumeQaRunner } from '../src/qa/crown-volume-qa-runner.js';
import { readYamlConfig } from './node-yaml-config.js';

const FILES = Object.freeze({
  presets: new URL('../config/tree-presets.yaml', import.meta.url),
  continuity: new URL('../config/foliage-continuity.yaml', import.meta.url),
  qa: new URL('../config/crown-volume-qa.yaml', import.meta.url),
});
const REPORT_FILES = Object.freeze(['report.json', 'report.md']);

function readOptions() {
  const { values } = parseArgs({
    options: {
      seeds: { type: 'string' },
      output: { type: 'string', default: 'qa-results/crown-volume' },
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

function renderMarkdown(report) {
  const lines = [
    '# Unified crown volume QA',
    '',
    `Result: **${report.passed ? 'PASS' : 'FAIL'}**`,
    '',
    `Samples: ${report.summary.samplesAnalyzed}`,
    `Failed samples: ${report.summary.failedSampleCount}`,
    `Aggregate failures: ${report.summary.aggregateFailureCount}`,
    `Deterministic mismatches: ${report.summary.deterministicMismatchCount}`,
    '',
  ];

  for (const [presetId, preset] of Object.entries(report.presets)) {
    lines.push(`## ${presetId}`, '');
    lines.push(`Result: **${preset.passed ? 'PASS' : 'FAIL'}**`);
    lines.push(
      `Unique volumes: ${preset.uniqueVolumeCount}/${preset.samplesAnalyzed}`,
      `Failed samples: ${preset.failedSampleCount}`,
      `Aggregate failures: ${preset.aggregateFailureCount}`,
      '',
      '| Metric | Min | P50 | P95 | Max | Mean |',
      '|---|---:|---:|---:|---:|---:|',
    );

    for (const [metric, summary] of Object.entries(preset.metrics)) {
      lines.push(
        `| ${metric} | ${summary.minimum} | ${summary.p50} | ${summary.p95} | ${summary.maximum} | ${summary.mean} |`,
      );
    }

    if (preset.failureExamples.length > 0) {
      lines.push('', '### Failures', '');
      for (const example of preset.failureExamples) {
        lines.push(
          `- Seed ${example.seed ?? 'aggregate'}: ${example.failures.join('; ')}`,
        );
      }
    }

    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function printSummary(report) {
  console.log(
    `Crown volume QA ${report.passed ? 'PASSED' : 'FAILED'}: ${report.summary.samplesAnalyzed} samples, ${report.summary.failedSampleCount} failed samples, ${report.summary.aggregateFailureCount} aggregate failures.`,
  );

  for (const [presetId, preset] of Object.entries(report.presets)) {
    console.log(
      `${presetId}: ${preset.passed ? 'PASS' : 'FAIL'}, unique ${preset.uniqueVolumeCount}/${preset.samplesAnalyzed}, triangles p50 ${preset.metrics.triangleCount.p50}.`,
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

  const validatedQaConfiguration = parseCrownVolumeQaConfig(qaConfiguration);
  const presets = PresetLibrary.fromConfig(
    presetConfiguration,
    continuityConfiguration,
  ).presets;
  const report = new CrownVolumeQaRunner().run(
    presets,
    validatedQaConfiguration,
  );
  await Promise.all([
    writeFile(
      `${options.output}/report.json`,
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    ),
    writeFile(`${options.output}/report.md`, renderMarkdown(report), 'utf8'),
  ]);

  printSummary(report);
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error('Crown volume QA failed to execute.', error);
  process.exitCode = 1;
});
