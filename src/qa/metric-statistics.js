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

function requireMetricValues(metricRows, metric) {
  const values = metricRows.map((row) => row[metric]);
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`QA metric '${metric}' is missing or not finite.`);
  }
  return values;
}

export function summarizeMetrics(metricRows) {
  if (!Array.isArray(metricRows) || metricRows.length === 0) {
    throw new Error('QA metric summary requires at least one row.');
  }

  const metricNames = Object.keys(metricRows[0]).filter(
    (name) => name !== 'seed' && typeof metricRows[0][name] === 'number',
  );
  const summary = {};

  for (const metric of metricNames.sort()) {
    const values = requireMetricValues(metricRows, metric);
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
  if (!Array.isArray(metricRows) || metricRows.length === 0) {
    throw new Error('Worst-seed analysis requires at least one metric row.');
  }

  const result = {};

  for (const metric of metricNames) {
    requireMetricValues(metricRows, metric);
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
