import { normalizeVector } from './lobe-geometry.js';

const MINIMUM_SMOOTHNESS = 1e-4;
const MINIMUM_GRADIENT_EPSILON = 1e-4;
const TAU = Math.PI * 2;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothMinimum(left, right, smoothing) {
  if (!Number.isFinite(left)) return right;

  const radius = Math.max(MINIMUM_SMOOTHNESS, smoothing);
  const blend = Math.max(radius - Math.abs(left - right), 0) / radius;
  return Math.min(left, right) - (blend * blend * blend * radius) / 6;
}

function prepareDistanceLobe(lobe) {
  const rotation = lobe.rotation ?? { x: 0, y: 0, z: 0 };
  const inverseX = -rotation.x;
  const inverseY = -rotation.y;
  const inverseZ = -rotation.z;

  return {
    position: lobe.position,
    inverseScaleX: 1 / lobe.scale.x,
    inverseScaleY: 1 / lobe.scale.y,
    inverseScaleZ: 1 / lobe.scale.z,
    minimumScale: Math.min(lobe.scale.x, lobe.scale.y, lobe.scale.z),
    cosX: Math.cos(inverseX),
    sinX: Math.sin(inverseX),
    cosY: Math.cos(inverseY),
    sinY: Math.sin(inverseY),
    cosZ: Math.cos(inverseZ),
    sinZ: Math.sin(inverseZ),
  };
}

function ellipsoidDistance(point, lobe) {
  const x = point.x - lobe.position.x;
  const y = point.y - lobe.position.y;
  const z = point.z - lobe.position.z;
  const xAfterZ = x * lobe.cosZ - y * lobe.sinZ;
  const yAfterZ = x * lobe.sinZ + y * lobe.cosZ;
  const xAfterY = xAfterZ * lobe.cosY + z * lobe.sinY;
  const zAfterY = -xAfterZ * lobe.sinY + z * lobe.cosY;
  const yAfterX = yAfterZ * lobe.cosX - zAfterY * lobe.sinX;
  const zAfterX = yAfterZ * lobe.sinX + zAfterY * lobe.cosX;
  const normalizedLength = Math.hypot(
    xAfterY * lobe.inverseScaleX,
    yAfterX * lobe.inverseScaleY,
    zAfterX * lobe.inverseScaleZ,
  );

  return (normalizedLength - 1) * lobe.minimumScale;
}

function createNoisePhases(seed) {
  const value = Number(seed) >>> 0;
  return {
    x: ((value * 0.1031) % 1) * TAU,
    y: ((value * 0.11369 + 0.37) % 1) * TAU,
    z: ((value * 0.13787 + 0.71) % 1) * TAU,
  };
}

function calculateNoise(point, phases, frequency) {
  const first =
    Math.sin(point.x * frequency + phases.x) *
    Math.cos(point.z * frequency * 0.83 + phases.z);
  const second = Math.sin(
    point.y * frequency * 0.67 +
      point.x * frequency * 0.21 +
      phases.y,
  );
  const third = Math.cos(
    (point.x + point.z) * frequency * 0.43 + phases.z - phases.x,
  );
  return first * 0.55 + second * 0.3 + third * 0.15;
}

function calculateBounds(lobes, padding) {
  const minimum = { x: Infinity, y: Infinity, z: Infinity };
  const maximum = { x: -Infinity, y: -Infinity, z: -Infinity };

  for (const lobe of lobes) {
    const radius = Math.max(lobe.scale.x, lobe.scale.y, lobe.scale.z) + padding;
    minimum.x = Math.min(minimum.x, lobe.position.x - radius);
    minimum.y = Math.min(minimum.y, lobe.position.y - radius);
    minimum.z = Math.min(minimum.z, lobe.position.z - radius);
    maximum.x = Math.max(maximum.x, lobe.position.x + radius);
    maximum.y = Math.max(maximum.y, lobe.position.y + radius);
    maximum.z = Math.max(maximum.z, lobe.position.z + radius);
  }

  return Object.freeze({
    minimum: Object.freeze(minimum),
    maximum: Object.freeze(maximum),
  });
}

export class CrownVolumeField {
  constructor(treeData) {
    if (!treeData?.lobes?.length) {
      throw new Error('CrownVolumeField requires at least one foliage lobe.');
    }

    this.lobes = treeData.lobes;
    this.distanceLobes = this.lobes.map(prepareDistanceLobe);
    this.settings = treeData.palette.volume;
    this.phases = createNoisePhases(treeData.seed);
    this.bounds = calculateBounds(this.lobes, this.settings.padding);
    this.crownHeight = Math.max(
      1e-6,
      this.bounds.maximum.y - this.bounds.minimum.y,
    );
  }

  sample(point) {
    let distance = Number.POSITIVE_INFINITY;

    for (const lobe of this.distanceLobes) {
      distance = smoothMinimum(
        distance,
        ellipsoidDistance(point, lobe),
        this.settings.smoothing,
      );
    }

    const normalizedHeight = clamp(
      (point.y - this.bounds.minimum.y) / this.crownHeight,
      0,
      1,
    );
    const edgeWeight = 0.55 + normalizedHeight * 0.45;
    const noise = calculateNoise(
      point,
      this.phases,
      this.settings.noiseFrequency,
    );
    return distance + noise * this.settings.noiseAmplitude * edgeWeight;
  }

  gradient(point) {
    const epsilon = Math.max(
      MINIMUM_GRADIENT_EPSILON,
      this.settings.normalEpsilon,
    );
    const x =
      this.sample({ x: point.x + epsilon, y: point.y, z: point.z }) -
      this.sample({ x: point.x - epsilon, y: point.y, z: point.z });
    const y =
      this.sample({ x: point.x, y: point.y + epsilon, z: point.z }) -
      this.sample({ x: point.x, y: point.y - epsilon, z: point.z });
    const z =
      this.sample({ x: point.x, y: point.y, z: point.z + epsilon }) -
      this.sample({ x: point.x, y: point.y, z: point.z - epsilon });
    return normalizeVector({ x, y, z });
  }
}
