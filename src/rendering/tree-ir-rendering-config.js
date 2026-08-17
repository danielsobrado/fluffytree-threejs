function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value;
}

function requireInteger(value, minimum, maximum, path) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${path} must be an integer within [${minimum}, ${maximum}].`);
  }
  return value;
}

function requireRange(value, minimum, maximum, path) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${path} must be within [${minimum}, ${maximum}].`);
  }
  return value;
}

function parseStructure(source, path) {
  requireObject(source, path);
  return Object.freeze({
    radialSegments: requireInteger(
      source.radialSegments,
      3,
      24,
      `${path}.radialSegments`,
    ),
    trunkCurveSamples: requireInteger(
      source.trunkCurveSamples,
      2,
      64,
      `${path}.trunkCurveSamples`,
    ),
    branchCurveSamples: requireInteger(
      source.branchCurveSamples,
      2,
      32,
      `${path}.branchCurveSamples`,
    ),
  });
}

function assertStructureNotMoreDetailed(lower, higher, path) {
  for (const field of [
    'radialSegments',
    'trunkCurveSamples',
    'branchCurveSamples',
  ]) {
    if (lower[field] > higher[field]) {
      throw new RangeError(`${path}.${field} must not exceed the higher-detail LOD.`);
    }
  }
}

function parseCrown(source) {
  const crown = Object.freeze({
    heroDetail: requireInteger(
      source.heroDetail,
      0,
      4,
      'treeIrRendering.directIr.crown.heroDetail',
    ),
    nearDetail: requireInteger(
      source.nearDetail,
      0,
      4,
      'treeIrRendering.directIr.crown.nearDetail',
    ),
    aggregateDetail: requireInteger(
      source.aggregateDetail,
      0,
      4,
      'treeIrRendering.directIr.crown.aggregateDetail',
    ),
    heroScale: requireRange(
      source.heroScale,
      0.2,
      1.5,
      'treeIrRendering.directIr.crown.heroScale',
    ),
    nearScale: requireRange(
      source.nearScale,
      0.2,
      1.5,
      'treeIrRendering.directIr.crown.nearScale',
    ),
    aggregateScale: requireRange(
      source.aggregateScale,
      0.2,
      1.5,
      'treeIrRendering.directIr.crown.aggregateScale',
    ),
  });

  if (crown.nearDetail > crown.heroDetail) {
    throw new RangeError(
      'treeIrRendering.directIr.crown.nearDetail must not exceed heroDetail.',
    );
  }
  if (crown.aggregateDetail > crown.nearDetail) {
    throw new RangeError(
      'treeIrRendering.directIr.crown.aggregateDetail must not exceed nearDetail.',
    );
  }
  return crown;
}

function parseFoliage(source) {
  const foliage = Object.freeze({
    alphaResolution: requireInteger(
      source.alphaResolution,
      16,
      256,
      'treeIrRendering.directIr.foliage.alphaResolution',
    ),
    alphaTest: requireRange(
      source.alphaTest,
      0,
      1,
      'treeIrRendering.directIr.foliage.alphaTest',
    ),
    heroCardPlanes: requireInteger(
      source.heroCardPlanes,
      1,
      3,
      'treeIrRendering.directIr.foliage.heroCardPlanes',
    ),
    nearCardPlanes: requireInteger(
      source.nearCardPlanes,
      1,
      3,
      'treeIrRendering.directIr.foliage.nearCardPlanes',
    ),
    heroScale: requireRange(
      source.heroScale,
      0.2,
      3,
      'treeIrRendering.directIr.foliage.heroScale',
    ),
    nearScale: requireRange(
      source.nearScale,
      0.2,
      3,
      'treeIrRendering.directIr.foliage.nearScale',
    ),
    frondNearSegmentRatio: requireRange(
      source.frondNearSegmentRatio,
      0.2,
      1,
      'treeIrRendering.directIr.foliage.frondNearSegmentRatio',
    ),
    frondAggregateDensity: requireRange(
      source.frondAggregateDensity,
      0.2,
      1,
      'treeIrRendering.directIr.foliage.frondAggregateDensity',
    ),
    frondAggregateSegmentRatio: requireRange(
      source.frondAggregateSegmentRatio,
      0.2,
      1,
      'treeIrRendering.directIr.foliage.frondAggregateSegmentRatio',
    ),
  });

  if (foliage.nearCardPlanes > foliage.heroCardPlanes) {
    throw new RangeError(
      'treeIrRendering.directIr.foliage.nearCardPlanes must not exceed heroCardPlanes.',
    );
  }
  if (foliage.frondAggregateSegmentRatio > foliage.frondNearSegmentRatio) {
    throw new RangeError(
      'treeIrRendering.directIr.foliage.frondAggregateSegmentRatio must not exceed frondNearSegmentRatio.',
    );
  }
  return foliage;
}

export function parseTreeIrRenderingConfig(config) {
  const source = requireObject(config?.directIr, 'treeIrRendering.directIr');
  const structureSource = requireObject(
    source.structure,
    'treeIrRendering.directIr.structure',
  );
  const crownSource = requireObject(source.crown, 'treeIrRendering.directIr.crown');
  const foliageSource = requireObject(
    source.foliage,
    'treeIrRendering.directIr.foliage',
  );
  const shadowSource = requireObject(
    source.shadow,
    'treeIrRendering.directIr.shadow',
  );

  const structure = Object.freeze({
    hero: parseStructure(
      structureSource.hero,
      'treeIrRendering.directIr.structure.hero',
    ),
    near: parseStructure(
      structureSource.near,
      'treeIrRendering.directIr.structure.near',
    ),
    aggregate: parseStructure(
      structureSource.aggregate,
      'treeIrRendering.directIr.structure.aggregate',
    ),
  });
  const crown = parseCrown(crownSource);
  const foliage = parseFoliage(foliageSource);
  const shadow = parseStructure(shadowSource, 'treeIrRendering.directIr.shadow');

  assertStructureNotMoreDetailed(
    structure.near,
    structure.hero,
    'treeIrRendering.directIr.structure.near',
  );
  assertStructureNotMoreDetailed(
    structure.aggregate,
    structure.near,
    'treeIrRendering.directIr.structure.aggregate',
  );
  assertStructureNotMoreDetailed(
    shadow,
    structure.near,
    'treeIrRendering.directIr.shadow',
  );

  return Object.freeze({ structure, crown, foliage, shadow });
}
