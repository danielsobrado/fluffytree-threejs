const GATED_METRICS = Object.freeze([
  'holeRatio',
  'largestHoleRatio',
  'coverageRatio',
  'coverageRetention',
]);

function isBelowMinimum(metric) {
  return metric === 'coverageRatio' || metric === 'coverageRetention';
}

function summarize(values) {
  const finiteValues = values.filter(Number.isFinite);
  return Object.freeze({
    minimum: finiteValues.length === 0 ? 0 : Math.min(...finiteValues),
    maximum: finiteValues.length === 0 ? 0 : Math.max(...finiteValues),
    mean:
      finiteValues.length === 0
        ? 0
        : finiteValues.reduce((total, value) => total + value, 0) /
          finiteValues.length,
  });
}

function viewLabel(view) {
  const lod = view.lodState ? `${view.lodState}/` : '';
  return `${view.group}/${lod}${view.name}`;
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

export function evaluateSolidityView(view, thresholds) {
  const failures = [];

  for (const metric of GATED_METRICS) {
    const limit = thresholds[metric];
    if (limit === undefined) continue;

    if (!Number.isFinite(limit)) {
      failures.push(`${viewLabel(view)} ${metric} threshold is not finite`);
      continue;
    }

    const actual = view[metric];
    if (!Number.isFinite(actual)) {
      failures.push(`${viewLabel(view)} ${metric} is not finite`);
      continue;
    }

    const failed = isBelowMinimum(metric) ? actual < limit : actual > limit;

    if (failed) {
      failures.push(
        `${viewLabel(view)} ${metric} ${actual.toFixed(5)} ${
          isBelowMinimum(metric) ? '<' : '>'
        } ${limit.toFixed(5)}`,
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

    const minimumWind = presetThresholds.minimumWindMovedRatio;
    if (minimumWind !== undefined) {
      if (!Number.isFinite(minimumWind)) {
        failures.push(
          `${tree.presetId} minimumWindMovedRatio threshold is not finite`,
        );
      } else if (!Number.isFinite(tree.windMovedRatio)) {
        failures.push(`${tree.presetId} windMovedRatio is not finite`);
      } else if (tree.windMovedRatio < minimumWind) {
        failures.push(
          `${tree.presetId} windMovedRatio ${tree.windMovedRatio.toFixed(4)} < ${minimumWind}`,
        );
      }
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
