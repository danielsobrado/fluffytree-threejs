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

function requireBoolean(value, path) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${path} must be a boolean.`);
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

function assertNonDecreasing(values, path) {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[index - 1]) {
      throw new RangeError(`${path} must not decrease toward lower-detail LODs.`);
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
    heroBrightness: requireRange(
      source.heroBrightness,
      0.4,
      1,
      'treeIrRendering.directIr.crown.heroBrightness',
    ),
    nearBrightness: requireRange(
      source.nearBrightness,
      0.4,
      1,
      'treeIrRendering.directIr.crown.nearBrightness',
    ),
    aggregateBrightness: requireRange(
      source.aggregateBrightness,
      0.4,
      1,
      'treeIrRendering.directIr.crown.aggregateBrightness',
    ),
    shapeVariation: requireRange(
      source.shapeVariation,
      0,
      0.25,
      'treeIrRendering.directIr.crown.shapeVariation',
    ),
    surfaceVariation: requireRange(
      source.surfaceVariation,
      0,
      0.2,
      'treeIrRendering.directIr.crown.surfaceVariation',
    ),
    depthShading: requireRange(
      source.depthShading,
      0,
      0.3,
      'treeIrRendering.directIr.crown.depthShading',
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
  assertNonDecreasing(
    [crown.heroScale, crown.nearScale, crown.aggregateScale],
    'treeIrRendering.directIr.crown scale',
  );
  assertNonDecreasing(
    [crown.heroBrightness, crown.nearBrightness, crown.aggregateBrightness],
    'treeIrRendering.directIr.crown brightness',
  );
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
    nearAlphaTest: requireRange(
      source.nearAlphaTest,
      0,
      1,
      'treeIrRendering.directIr.foliage.nearAlphaTest',
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
    heroCardDepthSpread: requireRange(
      source.heroCardDepthSpread,
      0,
      0.25,
      'treeIrRendering.directIr.foliage.heroCardDepthSpread',
    ),
    nearCardDepthSpread: requireRange(
      source.nearCardDepthSpread,
      0,
      0.25,
      'treeIrRendering.directIr.foliage.nearCardDepthSpread',
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
    cardScaleVariation: requireRange(
      source.cardScaleVariation,
      0,
      0.3,
      'treeIrRendering.directIr.foliage.cardScaleVariation',
    ),
    cardStretch: requireRange(
      source.cardStretch,
      0,
      0.3,
      'treeIrRendering.directIr.foliage.cardStretch',
    ),
    cardTwist: requireRange(
      source.cardTwist,
      0,
      Math.PI * 0.5,
      'treeIrRendering.directIr.foliage.cardTwist',
    ),
    cardLean: requireRange(
      source.cardLean,
      0,
      0.4,
      'treeIrRendering.directIr.foliage.cardLean',
    ),
    surfaceMottle: requireRange(
      source.surfaceMottle,
      0,
      0.2,
      'treeIrRendering.directIr.foliage.surfaceMottle',
    ),
    surfaceEdgeDarkening: requireRange(
      source.surfaceEdgeDarkening,
      0,
      0.2,
      'treeIrRendering.directIr.foliage.surfaceEdgeDarkening',
    ),
    surfaceVerticalTint: requireRange(
      source.surfaceVerticalTint,
      0,
      0.2,
      'treeIrRendering.directIr.foliage.surfaceVerticalTint',
    ),
    frondHeroLeaflets: requireBoolean(
      source.frondHeroLeaflets,
      'treeIrRendering.directIr.foliage.frondHeroLeaflets',
    ),
    frondNearLeaflets: requireBoolean(
      source.frondNearLeaflets,
      'treeIrRendering.directIr.foliage.frondNearLeaflets',
    ),
    frondAggregateLeaflets: requireBoolean(
      source.frondAggregateLeaflets,
      'treeIrRendering.directIr.foliage.frondAggregateLeaflets',
    ),
    frondRachisWidthRatio: requireRange(
      source.frondRachisWidthRatio,
      0.02,
      0.25,
      'treeIrRendering.directIr.foliage.frondRachisWidthRatio',
    ),
    frondLeafletLengthRatio: requireRange(
      source.frondLeafletLengthRatio,
      0.5,
      1,
      'treeIrRendering.directIr.foliage.frondLeafletLengthRatio',
    ),
    frondLeafletWidthRatio: requireRange(
      source.frondLeafletWidthRatio,
      0.2,
      1,
      'treeIrRendering.directIr.foliage.frondLeafletWidthRatio',
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
  if (foliage.nearCardDepthSpread > foliage.heroCardDepthSpread) {
    throw new RangeError(
      'treeIrRendering.directIr.foliage.nearCardDepthSpread must not exceed heroCardDepthSpread.',
    );
  }
  if (foliage.nearAlphaTest > foliage.alphaTest) {
    throw new RangeError(
      'treeIrRendering.directIr.foliage.nearAlphaTest must not exceed alphaTest.',
    );
  }
  if (foliage.frondNearLeaflets && !foliage.frondHeroLeaflets) {
    throw new RangeError(
      'treeIrRendering.directIr.foliage.frondNearLeaflets requires frondHeroLeaflets.',
    );
  }
  if (foliage.frondAggregateLeaflets && !foliage.frondNearLeaflets) {
    throw new RangeError(
      'treeIrRendering.directIr.foliage.frondAggregateLeaflets requires frondNearLeaflets.',
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
