const REQUIRED_FIELDS = Object.freeze([
  'enabled',
  'volumeSlices',
  'samplesPerSlice',
  'trunkSlices',
  'trunkRingCount',
  'saddleSamples',
  'capLayers',
  'capSamplesPerLayer',
  'microLayerCount',
  'radiusRatio',
  'trunkRadiusRatio',
  'clusterScaleRatio',
  'colorDrop',
  'axialJitter',
  'depthJitterRatio',
]);

function requireField(value, field, path) {
  if (value[field] === undefined) {
    throw new Error(`Missing required configuration '${path}.${field}'.`);
  }
}

function requireFinite(value, path) {
  if (!Number.isFinite(Number(value))) {
    throw new Error(`Configuration '${path}' must be a finite number.`);
  }
}

function requireRange(value, minimum, maximum, path) {
  requireFinite(value, path);
  const number = Number(value);
  if (number < minimum || number > maximum) {
    throw new Error(
      `Configuration '${path}' must be within [${minimum}, ${maximum}].`,
    );
  }
}

function requirePositiveInteger(value, minimum, maximum, path) {
  requireFinite(value, path);
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(
      `Configuration '${path}' must be an integer within [${minimum}, ${maximum}].`,
    );
  }
}

export function createCanopyClosureConfig(id, value) {
  const path = `${id}.foliage.leafDetail.closure`;
  if (!value || typeof value !== 'object') {
    throw new Error(`Missing object '${path}'.`);
  }

  for (const field of REQUIRED_FIELDS) requireField(value, field, path);

  if (typeof value.enabled !== 'boolean') {
    throw new Error(`Configuration '${path}.enabled' must be a boolean.`);
  }

  requirePositiveInteger(value.volumeSlices, 6, 64, `${path}.volumeSlices`);
  requirePositiveInteger(value.samplesPerSlice, 6, 64, `${path}.samplesPerSlice`);
  requirePositiveInteger(value.trunkSlices, 6, 96, `${path}.trunkSlices`);
  requirePositiveInteger(value.trunkRingCount, 2, 12, `${path}.trunkRingCount`);
  requirePositiveInteger(value.saddleSamples, 1, 12, `${path}.saddleSamples`);
  requirePositiveInteger(value.capLayers, 1, 8, `${path}.capLayers`);
  requirePositiveInteger(
    value.capSamplesPerLayer,
    4,
    64,
    `${path}.capSamplesPerLayer`,
  );
  requirePositiveInteger(value.microLayerCount, 1, 4, `${path}.microLayerCount`);
  requireRange(value.radiusRatio, 0.35, 1, `${path}.radiusRatio`);
  requireRange(value.trunkRadiusRatio, 0.08, 0.6, `${path}.trunkRadiusRatio`);
  requireRange(
    value.clusterScaleRatio,
    0.035,
    0.22,
    `${path}.clusterScaleRatio`,
  );
  requireRange(value.colorDrop, 0, 0.5, `${path}.colorDrop`);
  requireRange(value.axialJitter, 0, 0.5, `${path}.axialJitter`);
  requireRange(
    value.depthJitterRatio,
    0,
    0.5,
    `${path}.depthJitterRatio`,
  );

  return Object.freeze({ ...value });
}
