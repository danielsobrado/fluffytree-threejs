import {
  assertQaSeedRange,
  requireQaFinite,
  requireQaInteger,
  requireQaObject,
  requireQaUint32,
} from './qa-config-validation.js';

const CONFIG_PATH = 'stem-manifold-qa';

function parseVariants(value) {
  const path = `${CONFIG_PATH}.run.variants`;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Configuration '${path}' must contain at least one variant.`);
  }

  const ids = new Set();
  const variants = value.map((entry, index) => {
    const entryPath = `${path}[${index}]`;
    const source = requireQaObject(entry, entryPath);
    if (typeof source.id !== 'string' || source.id.trim() === '') {
      throw new Error(`Configuration '${entryPath}.id' must be a non-empty string.`);
    }
    const id = source.id.trim();
    if (ids.has(id)) {
      throw new Error(`Configuration '${path}' contains duplicate id '${id}'.`);
    }
    ids.add(id);

    return Object.freeze({
      id,
      radialSegments: requireQaInteger(
        source.radialSegments,
        `${entryPath}.radialSegments`,
        { minimum: 3 },
      ),
      trunkCurveSamples: requireQaInteger(
        source.trunkCurveSamples,
        `${entryPath}.trunkCurveSamples`,
        { minimum: 2 },
      ),
    });
  });

  return Object.freeze(variants);
}

export function parseStemManifoldQaConfig(config) {
  requireQaObject(config, CONFIG_PATH);
  const run = requireQaObject(config.run, `${CONFIG_PATH}.run`);
  const analysis = requireQaObject(config.analysis, `${CONFIG_PATH}.analysis`);
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
      variants: parseVariants(run.variants),
    }),
    analysis: Object.freeze({
      areaEpsilonRatio: requireQaFinite(
        analysis.areaEpsilonRatio,
        `${CONFIG_PATH}.analysis.areaEpsilonRatio`,
        { minimum: 0 },
      ),
      expectedEulerCharacteristic: requireQaInteger(
        analysis.expectedEulerCharacteristic,
        `${CONFIG_PATH}.analysis.expectedEulerCharacteristic`,
      ),
      minimumSignedVolume: requireQaFinite(
        analysis.minimumSignedVolume,
        `${CONFIG_PATH}.analysis.minimumSignedVolume`,
        { minimum: 0 },
      ),
      selfIntersectionEpsilonRatio: requireQaFinite(
        analysis.selfIntersectionEpsilonRatio,
        `${CONFIG_PATH}.analysis.selfIntersectionEpsilonRatio`,
        { minimum: 0 },
      ),
      maximumSelfIntersectionExamples: requireQaInteger(
        analysis.maximumSelfIntersectionExamples,
        `${CONFIG_PATH}.analysis.maximumSelfIntersectionExamples`,
        { minimum: 0 },
      ),
    }),
    report: Object.freeze({
      maximumFailureExamples: requireQaInteger(
        report.maximumFailureExamples,
        `${CONFIG_PATH}.report.maximumFailureExamples`,
        { minimum: 0 },
      ),
    }),
  });
}
