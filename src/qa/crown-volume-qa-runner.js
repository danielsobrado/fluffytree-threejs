import { CrownVolumeGenerator } from '../generation/crown-volume-generator.js';
import { TreeGenerator } from '../generation/tree-generator.js';
import { analyzeCrownVolume, hashCrownVolume } from './crown-volume-analyzer.js';

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * ratio)),
  );
  return sorted[index];
}

function round(value) {
  return Number(Number(value).toFixed(6));
}

function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const mean =
    sorted.length === 0
      ? 0
      : sorted.reduce((total, value) => total + value, 0) / sorted.length;

  return {
    minimum: round(sorted[0] ?? 0),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    maximum: round(sorted.at(-1) ?? 0),
    mean: round(mean),
  };
}

function evaluateMetrics(metrics, thresholds) {
  const failures = [];

  for (const [metric, expected] of Object.entries(thresholds.exact)) {
    if (metrics[metric] !== expected) {
      failures.push(`${metric} expected ${expected}, received ${metrics[metric]}`);
    }
  }

  for (const [metric, [minimum, maximum]] of Object.entries(
    thresholds.ranges,
  )) {
    const value = metrics[metric];
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      failures.push(
        `${metric} expected within [${minimum}, ${maximum}], received ${value}`,
      );
    }
  }

  return failures;
}

function summarizeMetrics(samples, metricNames) {
  return Object.fromEntries(
    metricNames.map((metric) => [
      metric,
      summarize(samples.map((sample) => Number(sample.metrics[metric]))),
    ]),
  );
}

export class CrownVolumeQaRunner {
  constructor({
    treeGenerator = new TreeGenerator(),
    volumeGenerator = new CrownVolumeGenerator(),
  } = {}) {
    this.treeGenerator = treeGenerator;
    this.volumeGenerator = volumeGenerator;
  }

  run(presetMap, configuration) {
    const presets = {};
    let totalSamples = 0;
    let totalFailures = 0;
    let deterministicMismatchCount = 0;

    for (const [presetId, preset] of presetMap) {
      const samples = [];
      const hashes = new Set();
      const failureExamples = [];
      let presetFailures = 0;

      for (let offset = 0; offset < configuration.run.seedCount; offset += 1) {
        const seed = configuration.run.seedStart + offset;
        const tree = this.treeGenerator.generate(preset, seed);
        const volume = this.volumeGenerator.generate(tree);
        const hash = hashCrownVolume(volume);
        const metrics = analyzeCrownVolume(volume);
        const failures = evaluateMetrics(metrics, configuration.thresholds);
        hashes.add(hash);

        for (
          let replay = 1;
          replay < configuration.run.deterministicReplayCount;
          replay += 1
        ) {
          const replayTree = this.treeGenerator.generate(preset, seed);
          const replayVolume = this.volumeGenerator.generate(replayTree);
          if (hashCrownVolume(replayVolume) !== hash) {
            deterministicMismatchCount += 1;
            failures.push(`deterministic replay ${replay} produced a new hash`);
          }
        }

        if (failures.length > 0) {
          presetFailures += 1;
          if (failureExamples.length < 12) {
            failureExamples.push({ seed, failures });
          }
        }

        samples.push({ seed, hash, metrics });
      }

      const uniqueHashRate = hashes.size / samples.length;
      if (uniqueHashRate < configuration.thresholds.minimumUniqueHashRate) {
        presetFailures += 1;
        failureExamples.push({
          seed: null,
          failures: [
            `unique hash rate ${uniqueHashRate} is below ${configuration.thresholds.minimumUniqueHashRate}`,
          ],
        });
      }

      presets[presetId] = {
        passed: presetFailures === 0,
        samplesAnalyzed: samples.length,
        failedSampleCount: presetFailures,
        uniqueVolumeCount: hashes.size,
        uniqueHashRate: round(uniqueHashRate),
        metrics: summarizeMetrics(samples, configuration.report.metrics),
        failureExamples,
      };
      totalSamples += samples.length;
      totalFailures += presetFailures;
    }

    return {
      passed: totalFailures === 0 && deterministicMismatchCount === 0,
      generatedAt: new Date().toISOString(),
      configuration: configuration.run,
      summary: {
        samplesAnalyzed: totalSamples,
        failedSampleCount: totalFailures,
        deterministicMismatchCount,
      },
      presets,
    };
  }
}
