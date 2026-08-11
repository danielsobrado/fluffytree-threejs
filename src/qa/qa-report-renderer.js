function formatNumber(value) {
  if (!Number.isFinite(value)) {
    throw new Error(`QA report contains a non-finite metric value '${value}'.`);
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(4);
}

function renderMetricTable(report, metricNames) {
  const lines = [
    '| Metric | Min | P05 | P50 | P95 | Max | Mean |',
    '|---|---:|---:|---:|---:|---:|---:|',
  ];

  for (const metric of metricNames) {
    const statistics = report.metrics[metric];
    if (!statistics) {
      throw new Error(`QA report is missing configured summary metric '${metric}'.`);
    }
    lines.push(
      `| ${metric} | ${formatNumber(statistics.minimum)} | ${formatNumber(statistics.p05)} | ${formatNumber(statistics.p50)} | ${formatNumber(statistics.p95)} | ${formatNumber(statistics.maximum)} | ${formatNumber(statistics.mean)} |`,
    );
  }

  return lines.join('\n');
}

function renderFailures(report) {
  const entries = Object.entries(report.gateFailureCounts);
  if (entries.length === 0) return 'No gate failures.';
  return entries
    .map(([metric, count]) => `- ${metric}: ${count}`)
    .join('\n');
}

export function renderQaMarkdown(report, metricNames) {
  const lines = [
    '# Deterministic procedural tree shape QA',
    '',
    `**Status:** ${report.passed ? 'PASS' : 'FAIL'}`,
    '',
    `Analyzed ${report.summary.treesAnalyzed} generated trees across ${report.summary.presetCount} presets using seeds ${report.configuration.seedStart}–${report.configuration.seedStart + report.configuration.seedCount - 1}.`,
    '',
    `Silhouette grid: ${report.configuration.silhouetteResolution}² per view. Volume grid: ${report.configuration.volumeResolution}³. Deterministic replays: ${report.configuration.deterministicReplayCount}.`,
  ];

  for (const [presetId, preset] of Object.entries(report.presets)) {
    lines.push(
      '',
      `## ${preset.label} (${presetId})`,
      '',
      `- Status: **${preset.passed ? 'PASS' : 'FAIL'}**`,
      `- Profile: ${preset.profile}`,
      `- Trees analyzed: ${preset.treesAnalyzed}`,
      `- Failed trees: ${preset.failedTreeCount}`,
      `- Unique trees: ${preset.uniqueTreeCount}/${preset.treesAnalyzed}`,
      `- Determinism mismatches: ${preset.deterministicMismatchCount}`,
      '',
      renderMetricTable(preset, metricNames),
      '',
      '### Gate failures',
      '',
      renderFailures(preset),
    );
  }

  return `${lines.join('\n')}\n`;
}
