import { TreeGenerator } from '../generation/tree-generator.js?v=2.0.0-20260814.2';
import {
  findWorstSeeds,
  summarizeMetrics,
} from './metric-statistics.js?v=2.0.0-20260814.2';
import { evaluateShapeGates } from './shape-gates.js?v=2.0.0-20260814.2';
import { hashTree } from './tree-hash.js?v=2.0.0-20260814.2';
import { TreeShapeAnalyzer } from './tree-shape-analyzer.js?v=2.0.0-20260814.2';

function createFailureTally() {
  return new Map();
}

function addFailures(tally, failures) {
  for (const failure of failures) {
    tally.set(failure.metric, (tally.get(failure.metric) ?? 0) + 1);
  }
}

function serializeFailureTally(tally) {
  return Object.fromEntries(
    [...tally.entries()].sort((left, right) => {
      const countDifference = right[1] - left[1];
      return countDifference !== 0
        ? countDifference
        : left[0].localeCompare(right[0]);
    }),
  );
}

function replayTree(generator, preset, seed, expectedHash, replayCount) {
  for (let replay = 1; replay < replayCount; replay += 1) {
    if (hashTree(generator.generate(preset, seed)) !== expectedHash) {
      return false;
    }
  }

  return true;
}

export class TreeShapeQaRunner {
  constructor({ generator = new TreeGenerator() } = {}) {
    this.generator = generator;
  }

  run(presets, configuration) {
    const analyzer = new TreeShapeAnalyzer(configuration.analysis);
    const presetReports = {};
    let totalTrees = 0;
    let totalFailedTrees = 0;
    let deterministicMismatchCount = 0;

    for (const [presetId, preset] of presets) {
      const metricRows = [];
      const hashes = new Set();
      const failureTally = createFailureTally();
      const failureExamples = [];
      let failedTreeCount = 0;
      let presetDeterminismMismatches = 0;

      for (
        let offset = 0;
        offset < configuration.run.seedCount;
        offset += 1
      ) {
        const seed = configuration.run.seedStart + offset;
        const tree = this.generator.generate(preset, seed);
        const treeHash = hashTree(tree);
        const deterministic = replayTree(
          this.generator,
          preset,
          seed,
          treeHash,
          configuration.run.deterministicReplayCount,
        );
        const metrics = analyzer.analyze(tree, preset);
        const failures = evaluateShapeGates(
          metrics,
          preset,
          configuration.thresholds,
        );

        hashes.add(treeHash);
        metricRows.push(metrics);

        if (!deterministic) {
          presetDeterminismMismatches += 1;
        }

        if (failures.length > 0) {
          failedTreeCount += 1;
          addFailures(failureTally, failures);

          if (
            failureExamples.length <
            configuration.report.maximumFailureExamples
          ) {
            failureExamples.push({ seed, failures });
          }
        }
      }

      const failureRate = failedTreeCount / configuration.run.seedCount;
      const uniqueHashRate = hashes.size / configuration.run.seedCount;
      const passed =
        failureRate <=
          configuration.thresholds.aggregate.maximumFailureRate &&
        uniqueHashRate >=
          configuration.thresholds.aggregate.minimumUniqueHashRate &&
        presetDeterminismMismatches === 0;

      presetReports[presetId] = {
        label: preset.label,
        profile: preset.crown.profile,
        passed,
        treesAnalyzed: configuration.run.seedCount,
        failedTreeCount,
        failureRate,
        uniqueTreeCount: hashes.size,
        uniqueHashRate,
        deterministicMismatchCount: presetDeterminismMismatches,
        gateFailureCounts: serializeFailureTally(failureTally),
        failureExamples,
        metrics: summarizeMetrics(metricRows),
        worstSeeds: findWorstSeeds(
          metricRows,
          configuration.report.worstSeedMetrics,
        ),
      };

      totalTrees += configuration.run.seedCount;
      totalFailedTrees += failedTreeCount;
      deterministicMismatchCount += presetDeterminismMismatches;
    }

    const passed = Object.values(presetReports).every(
      (report) => report.passed,
    );

    return {
      schemaVersion: 1,
      passed,
      configuration: {
        seedStart: configuration.run.seedStart,
        seedCount: configuration.run.seedCount,
        deterministicReplayCount:
          configuration.run.deterministicReplayCount,
        silhouetteResolution:
          configuration.analysis.silhouetteResolution,
        volumeResolution: configuration.analysis.volumeResolution,
        profileSampleCount: configuration.analysis.profileSampleCount,
      },
      summary: {
        presetCount: presets.size,
        treesAnalyzed: totalTrees,
        failedTreeCount: totalFailedTrees,
        deterministicMismatchCount,
      },
      presets: presetReports,
    };
  }
}
