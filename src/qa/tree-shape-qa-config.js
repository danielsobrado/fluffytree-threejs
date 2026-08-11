import { CROWN_PROFILE_IDS } from '../generation/crown-envelope.js';
import {
  assertQaSeedRange,
  parseQaExactMap,
  parseQaRangeMap,
  requireQaFinite,
  requireQaInteger,
  requireQaObject,
  requireQaStringArray,
  requireQaUint32,
} from './qa-config-validation.js';

const CONFIG_PATH = 'tree-shape-qa';
const VERTICAL_BAND_COUNT = 3;

function parseVerticalBandCounts(value, path) {
  if (!Array.isArray(value) || value.length !== VERTICAL_BAND_COUNT) {
    throw new Error(
      `Configuration '${path}' must contain exactly ${VERTICAL_BAND_COUNT} counts.`,
    );
  }

  return Object.freeze(
    value.map((count, index) =>
      requireQaInteger(count, `${path}[${index}]`, { minimum: 0 }),
    ),
  );
}

function parseProfileThreshold(value, path) {
  const source = requireQaObject(value, path);
  return Object.freeze({
    minimumVerticalBandCounts: parseVerticalBandCounts(
      source.minimumVerticalBandCounts,
      `${path}.minimumVerticalBandCounts`,
    ),
    ranges: parseQaRangeMap(source.ranges, `${path}.ranges`),
  });
}

function parsePresetOverride(value, path) {
  const source = requireQaObject(value, path);
  const parsed = {};

  if (source.minimumVerticalBandCounts !== undefined) {
    parsed.minimumVerticalBandCounts = parseVerticalBandCounts(
      source.minimumVerticalBandCounts,
      `${path}.minimumVerticalBandCounts`,
    );
  }
  if (source.ranges !== undefined) {
    parsed.ranges = parseQaRangeMap(source.ranges, `${path}.ranges`);
  }
  if (Object.keys(parsed).length === 0) {
    throw new Error(`Configuration '${path}' must override at least one threshold.`);
  }
  return Object.freeze(parsed);
}

function parseProfiles(value) {
  const source = requireQaObject(value, `${CONFIG_PATH}.thresholds.profiles`);
  const profiles = {};

  for (const profileId of CROWN_PROFILE_IDS) {
    profiles[profileId] = parseProfileThreshold(
      source[profileId],
      `${CONFIG_PATH}.thresholds.profiles.${profileId}`,
    );
  }
  for (const profileId of Object.keys(source)) {
    if (!CROWN_PROFILE_IDS.includes(profileId)) {
      throw new Error(
        `Configuration '${CONFIG_PATH}.thresholds.profiles' contains unknown profile '${profileId}'.`,
      );
    }
  }
  return Object.freeze(profiles);
}

function parsePresetOverrides(value) {
  if (value === undefined) return Object.freeze({});
  const source = requireQaObject(value, `${CONFIG_PATH}.thresholds.presets`);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(source).map(([presetId, override]) => [
        presetId,
        parsePresetOverride(
          override,
          `${CONFIG_PATH}.thresholds.presets.${presetId}`,
        ),
      ]),
    ),
  );
}

export function parseTreeShapeQaConfig(config) {
  requireQaObject(config, CONFIG_PATH);
  const run = requireQaObject(config.run, `${CONFIG_PATH}.run`);
  const analysis = requireQaObject(config.analysis, `${CONFIG_PATH}.analysis`);
  const thresholds = requireQaObject(
    config.thresholds,
    `${CONFIG_PATH}.thresholds`,
  );
  const aggregate = requireQaObject(
    thresholds.aggregate,
    `${CONFIG_PATH}.thresholds.aggregate`,
  );
  const common = requireQaObject(
    thresholds.common,
    `${CONFIG_PATH}.thresholds.common`,
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
    analysis: Object.freeze({
      silhouetteResolution: requireQaInteger(
        analysis.silhouetteResolution,
        `${CONFIG_PATH}.analysis.silhouetteResolution`,
        { minimum: 2 },
      ),
      volumeResolution: requireQaInteger(
        analysis.volumeResolution,
        `${CONFIG_PATH}.analysis.volumeResolution`,
        { minimum: 2 },
      ),
      profileSampleCount: requireQaInteger(
        analysis.profileSampleCount,
        `${CONFIG_PATH}.analysis.profileSampleCount`,
        { minimum: 2 },
      ),
    }),
    thresholds: Object.freeze({
      aggregate: Object.freeze({
        maximumFailureRate: requireQaFinite(
          aggregate.maximumFailureRate,
          `${CONFIG_PATH}.thresholds.aggregate.maximumFailureRate`,
          { minimum: 0, maximum: 1 },
        ),
        minimumUniqueHashRate: requireQaFinite(
          aggregate.minimumUniqueHashRate,
          `${CONFIG_PATH}.thresholds.aggregate.minimumUniqueHashRate`,
          { minimum: 0, maximum: 1 },
        ),
      }),
      common: Object.freeze({
        exact: parseQaExactMap(
          common.exact,
          `${CONFIG_PATH}.thresholds.common.exact`,
        ),
        ranges: parseQaRangeMap(
          common.ranges,
          `${CONFIG_PATH}.thresholds.common.ranges`,
        ),
      }),
      profiles: parseProfiles(thresholds.profiles),
      presets: parsePresetOverrides(thresholds.presets),
    }),
    report: Object.freeze({
      maximumFailureExamples: requireQaInteger(
        report.maximumFailureExamples,
        `${CONFIG_PATH}.report.maximumFailureExamples`,
        { minimum: 0 },
      ),
      summaryMetrics: requireQaStringArray(
        report.summaryMetrics,
        `${CONFIG_PATH}.report.summaryMetrics`,
      ),
      worstSeedMetrics: requireQaStringArray(
        report.worstSeedMetrics,
        `${CONFIG_PATH}.report.worstSeedMetrics`,
      ),
    }),
  });
}
