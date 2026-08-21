import {
  requireQaFinite,
  requireQaObject,
} from './qa-config-validation.js?v=2.0.0-20260814.2';

const CONFIG_PATH = 'canopy-solidity-qa';

function requireRatio(value, path) {
  return requireQaFinite(value, path, { minimum: 0, maximum: 1 });
}

function parseGroup(value, path, { coverageRetention = false } = {}) {
  const source = requireQaObject(value, path);
  const parsed = {
    holeRatio: requireRatio(source.holeRatio, `${path}.holeRatio`),
    largestHoleRatio: requireRatio(
      source.largestHoleRatio,
      `${path}.largestHoleRatio`,
    ),
    coverageRatio: requireRatio(source.coverageRatio, `${path}.coverageRatio`),
  };

  if (coverageRetention) {
    parsed.coverageRetention = requireRatio(
      source.coverageRetention,
      `${path}.coverageRetention`,
    );
  }
  return Object.freeze(parsed);
}

export function parseCanopySolidityQaConfig(config) {
  requireQaObject(config, CONFIG_PATH);
  const source = requireQaObject(
    config.thresholds,
    `${CONFIG_PATH}.thresholds`,
  );
  const thresholds = {};

  for (const [presetId, value] of Object.entries(source)) {
    const path = `${CONFIG_PATH}.thresholds.${presetId}`;
    const preset = requireQaObject(value, path);
    thresholds[presetId] = Object.freeze({
      minimumWindMovedRatio: requireRatio(
        preset.minimumWindMovedRatio,
        `${path}.minimumWindMovedRatio`,
      ),
      crown: parseGroup(preset.crown, `${path}.crown`, {
        coverageRetention: true,
      }),
      base: parseGroup(preset.base, `${path}.base`),
    });
  }

  if (Object.keys(thresholds).length === 0) {
    throw new Error(
      `Configuration '${CONFIG_PATH}.thresholds' must not be empty.`,
    );
  }

  return Object.freeze({ thresholds: Object.freeze(thresholds) });
}
