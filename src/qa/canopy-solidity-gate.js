const GATED_METRICS = Object.freeze([
  'holeRatio',
  'largestHoleRatio',
  'coverageRatio',
]);

function isBelowMinimum(metric) {
  return metric === 'coverageRatio';
}

function summarize(values) {
  return Object.freeze({
    minimum: values.length === 0 ? 0 : Math.min(...values),
    maximum: values.length === 0 ? 0 : Math.max(...values),
    mean:
      values.length === 0
        ? 0
        : values.reduce((total, value) => total + value, 0) / values.length,
  });
}

export function summarizeViewMetrics(views) {
  const summary = {};

  for (const metric of GATED_METRICS) {
    summary[metric] = summarize(views.map((view) => view[metric]));
  }

  summary.holeCount = summarize(views.map((view) => view.holeCount));
  summary.largestHolePixels = summarize(
    views.map((view) => view.largestHolePixels),
  );
  return Object.freeze(summary);
}

/**
 * A view fails when the camera can see through the model more than the preset
 * allows, either in total or through one single opening.
 */
export function evaluateSolidityView(view, thresholds) {
  const failures = [];

  for (const metric of GATED_METRICS) {
    const limit = thresholds[metric];
    if (limit === undefined) continue;

    const actual = view[metric];
    const failed = isBelowMinimum(metric) ? actual < limit : actual > limit;

    if (failed) {
      failures.push(
        `${view.group}/${view.name} ${metric} ${actual.toFixed(5)} ${
          isBelowMinimum(metric) ? '<' : '>'
        } ${Number(limit).toFixed(5)}`,
      );
    }
  }

  return failures;
}

export function evaluateSolidityReport(trees, thresholds) {
  const failures = [];

  for (const tree of trees) {
    const presetThresholds = thresholds[tree.presetId];

    if (!presetThresholds) {
      failures.push(`Missing canopy solidity thresholds for '${tree.presetId}'.`);
      continue;
    }

    for (const view of tree.views) {
      const groupThresholds = presetThresholds[view.group];

      if (!groupThresholds) {
        failures.push(
          `Missing '${view.group}' solidity thresholds for '${tree.presetId}'.`,
        );
        continue;
      }

      for (const failure of evaluateSolidityView(view, groupThresholds)) {
        failures.push(`${tree.presetId} ${failure}`);
      }
    }
  }

  return failures;
}
