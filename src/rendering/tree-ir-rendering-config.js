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

export function parseTreeIrRenderingConfig(config) {
  const source = requireObject(config?.directIr, 'treeIrRendering.directIr');
  const structure = requireObject(source.structure, 'treeIrRendering.directIr.structure');
  const crown = requireObject(source.crown, 'treeIrRendering.directIr.crown');
  const foliage = requireObject(source.foliage, 'treeIrRendering.directIr.foliage');
  const shadow = requireObject(source.shadow, 'treeIrRendering.directIr.shadow');

  return Object.freeze({
    structure: Object.freeze({
      hero: parseStructure(structure.hero, 'treeIrRendering.directIr.structure.hero'),
      near: parseStructure(structure.near, 'treeIrRendering.directIr.structure.near'),
      aggregate: parseStructure(
        structure.aggregate,
        'treeIrRendering.directIr.structure.aggregate',
      ),
    }),
    crown: Object.freeze({
      heroDetail: requireInteger(crown.heroDetail, 0, 4, 'treeIrRendering.directIr.crown.heroDetail'),
      nearDetail: requireInteger(crown.nearDetail, 0, 4, 'treeIrRendering.directIr.crown.nearDetail'),
      aggregateDetail: requireInteger(
        crown.aggregateDetail,
        0,
        4,
        'treeIrRendering.directIr.crown.aggregateDetail',
      ),
      heroScale: requireRange(crown.heroScale, 0.2, 1.5, 'treeIrRendering.directIr.crown.heroScale'),
      nearScale: requireRange(crown.nearScale, 0.2, 1.5, 'treeIrRendering.directIr.crown.nearScale'),
      aggregateScale: requireRange(
        crown.aggregateScale,
        0.2,
        1.5,
        'treeIrRendering.directIr.crown.aggregateScale',
      ),
    }),
    foliage: Object.freeze({
      alphaResolution: requireInteger(
        foliage.alphaResolution,
        16,
        256,
        'treeIrRendering.directIr.foliage.alphaResolution',
      ),
      alphaTest: requireRange(
        foliage.alphaTest,
        0,
        1,
        'treeIrRendering.directIr.foliage.alphaTest',
      ),
      heroCardPlanes: requireInteger(
        foliage.heroCardPlanes,
        1,
        3,
        'treeIrRendering.directIr.foliage.heroCardPlanes',
      ),
      nearCardPlanes: requireInteger(
        foliage.nearCardPlanes,
        1,
        3,
        'treeIrRendering.directIr.foliage.nearCardPlanes',
      ),
      heroScale: requireRange(
        foliage.heroScale,
        0.2,
        3,
        'treeIrRendering.directIr.foliage.heroScale',
      ),
      nearScale: requireRange(
        foliage.nearScale,
        0.2,
        3,
        'treeIrRendering.directIr.foliage.nearScale',
      ),
      frondNearSegmentRatio: requireRange(
        foliage.frondNearSegmentRatio,
        0.2,
        1,
        'treeIrRendering.directIr.foliage.frondNearSegmentRatio',
      ),
      frondAggregateDensity: requireRange(
        foliage.frondAggregateDensity,
        0.2,
        1,
        'treeIrRendering.directIr.foliage.frondAggregateDensity',
      ),
      frondAggregateSegmentRatio: requireRange(
        foliage.frondAggregateSegmentRatio,
        0.2,
        1,
        'treeIrRendering.directIr.foliage.frondAggregateSegmentRatio',
      ),
    }),
    shadow: parseStructure(shadow, 'treeIrRendering.directIr.shadow'),
  });
}
