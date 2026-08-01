import { CrownVolumeField } from '../generation/crown-volume-field.js';
import { TreeGenerator } from '../generation/tree-generator.js';
import { CanopyClosureSampler } from '../rendering/canopy-closure-sampler.js';
import { CanopyOccupancyAnalyzer } from './canopy-occupancy-analyzer.js';

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * ratio)),
  );
  return sorted[index];
}

function summarize(values) {
  return Object.freeze({
    minimum: Math.min(...values),
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
  });
}

function validateMetrics(metrics, thresholds) {
  const failures = [];

  for (const metric of [
    'coverageRatio',
    'minimumSliceCoverage',
    'trunkCoverageRatio',
    'capCoverageRatio',
  ]) {
    if (metrics[metric] < thresholds[metric]) {
      failures.push(
        `${metric} ${metrics[metric].toFixed(4)} < ${thresholds[metric].toFixed(4)}`,
      );
    }
  }

  return failures;
}

function createSeed(run, index) {
  return (
    Number(run.firstSeed) + Math.imul(index, Number(run.seedStep))
  ) >>> 0;
}

export class CanopyOccupancyQaRunner {
  constructor({
    treeGenerator = new TreeGenerator(),
    closureSampler = new CanopyClosureSampler(),
    analyzer = new CanopyOccupancyAnalyzer(),
  } = {}) {
    this.treeGenerator = treeGenerator;
    this.closureSampler = closureSampler;
    this.analyzer = analyzer;
  }

  run(presetMap, configuration) {
    const presets = {};
    let failedTreeCount = 0;

    for (const [presetId, preset] of presetMap) {
      const thresholds = configuration.thresholds[presetId];
      if (!thresholds) {
        throw new Error(`Missing occupancy thresholds for preset '${presetId}'.`);
      }

      const results = [];
      const failures = [];

      for (let index = 0; index < configuration.run.seedCount; index += 1) {
        const seed = createSeed(configuration.run, index);
        const treeData = this.treeGenerator.generate(preset, seed, {
          includeSurfaceSamples: false,
        });
        const field = new CrownVolumeField(treeData);
        const first = this.closureSampler.generate(treeData, field);
        const second = this.closureSampler.generate(treeData, field);
        const deterministic = JSON.stringify(first) === JSON.stringify(second);
        const metrics = this.analyzer.analyze(
          treeData,
          field,
          first,
          configuration.probe,
        );
        const metricFailures = validateMetrics(metrics, thresholds);

        if (!deterministic) {
          metricFailures.push('closure samples are not deterministic');
        }
        if (metricFailures.length > 0) {
          failedTreeCount += 1;
          failures.push({ seed, failures: metricFailures, metrics });
        }

        results.push(metrics);
      }

      presets[presetId] = Object.freeze({
        passed: failures.length === 0,
        treesAnalyzed: results.length,
        failedTreeCount: failures.length,
        metrics: Object.freeze({
          coverageRatio: summarize(
            results.map((value) => value.coverageRatio),
          ),
          minimumSliceCoverage: summarize(
            results.map((value) => value.minimumSliceCoverage),
          ),
          trunkCoverageRatio: summarize(
            results.map((value) => value.trunkCoverageRatio),
          ),
          capCoverageRatio: summarize(
            results.map((value) => value.capCoverageRatio),
          ),
        }),
        failures: Object.freeze(
          failures.slice(0, configuration.report.maxFailures),
        ),
      });
    }

    return Object.freeze({
      passed: failedTreeCount === 0,
      summary: Object.freeze({
        seedCount: configuration.run.seedCount,
        treesAnalyzed: configuration.run.seedCount * presetMap.size,
        failedTreeCount,
      }),
      presets: Object.freeze(presets),
    });
  }
}
