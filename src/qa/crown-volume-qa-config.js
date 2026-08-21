import {
  assertQaSeedRange,
  parseQaExactMap,
  parseQaRangeMap,
  requireQaFinite,
  requireQaInteger,
  requireQaObject,
  requireQaStringArray,
  requireQaUint32,
} from './qa-config-validation.js?v=2.0.0-20260814.2';

const CONFIG_PATH = 'crown-volume-qa';

export function parseCrownVolumeQaConfig(config) {
  requireQaObject(config, CONFIG_PATH);
  const run = requireQaObject(config.run, `${CONFIG_PATH}.run`);
  const thresholds = requireQaObject(
    config.thresholds,
    `${CONFIG_PATH}.thresholds`,
  );
  const report = requireQaObject(config.report, `${CONFIG_PATH}.report`);

  const seedStart = requireQaUint32(
    run.seedStart,
    `${CONFIG_PATH}.run.seedStart`,
  );
  const seedCount = requireQaInteger(
    run.seedCount,
    `${CONFIG_PATH}.run.seedCount`,
    { minimum: 1 },
  );
  assertQaSeedRange(seedStart, seedCount, `${CONFIG_PATH}.run`);

  return Object.freeze({
    run: Object.freeze({
      seedStart,
      seedCount,
      deterministicReplayCount: requireQaInteger(
        run.deterministicReplayCount,
        `${CONFIG_PATH}.run.deterministicReplayCount`,
        { minimum: 2 },
      ),
    }),
    thresholds: Object.freeze({
      minimumUniqueHashRate: requireQaFinite(
        thresholds.minimumUniqueHashRate,
        `${CONFIG_PATH}.thresholds.minimumUniqueHashRate`,
        { minimum: 0, maximum: 1 },
      ),
      exact: parseQaExactMap(
        thresholds.exact,
        `${CONFIG_PATH}.thresholds.exact`,
      ),
      ranges: parseQaRangeMap(
        thresholds.ranges,
        `${CONFIG_PATH}.thresholds.ranges`,
      ),
    }),
    report: Object.freeze({
      metrics: requireQaStringArray(
        report.metrics,
        `${CONFIG_PATH}.report.metrics`,
      ),
    }),
  });
}
