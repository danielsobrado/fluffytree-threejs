import { mean, quantile, standardDeviation } from './qa-math.js';

const QUANTILES = Object.freeze([
  ['p01', 0.01],
  ['p05', 0.05],
  ['p50', 0.5],
  ['p95', 0.95],
  ['p99', 0.99],
]);

function round(value) {
  return Number(value.toFixed(6));
}

export function summarizeMetrics(metricRows) {
  const metricNames = Object.keys(metricRows[0]).filter(
    (name) => name !== 'seed' && typeof metricRows[0][name] === 'number',
  );
  const summary = {};

  for (const metric of metricNames.sort()) {
    const values = metricRows.map((row) => row[metric]);
    const sorted = [...values].sort((left, right) => left - right);
    const statistics = {
      minimum: round(sorted[0]),
      mean: round(mean(values)),
      standardDeviation: round(standardDeviation(values)),
    };

    for (const [name, probability] of QUANTILES) {
      statistics[name] = round(quantile(sorted, probability));
    }

    statistics.maximum = round(sorted.at(-1));
    summary[metric] = statistics;
  }

  return summary;
}

export function findWorstSeeds(metricRows, metricNames) {
  const result = {};

  for (const metric of metricNames) {
    const sorted = [...metricRows].sort(
      (left, right) => left[metric] - right[metric],
    );
    result[metric] = {
      minimum: { seed: sorted[0].seed, value: sorted[0][metric] },
      maximum: {
        seed: sorted.at(-1).seed,
        value: sorted.at(-1)[metric],
      },
    };
  }

  return result;
}
