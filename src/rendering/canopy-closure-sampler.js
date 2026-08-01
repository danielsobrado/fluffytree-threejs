import { CANOPY_CLOSURE_CONSTANTS } from './canopy-closure-constants.js';

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function interpolate(left, right, ratio) {
  return left + (right - left) * ratio;
}

function interpolatePoint(left, right, ratio) {
  return {
    x: interpolate(left.x, right.x, ratio),
    y: interpolate(left.y, right.y, ratio),
    z: interpolate(left.z, right.z, ratio),
  };
}

function length(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize(vector, fallback = { x: 0, y: 1, z: 0 }) {
  const magnitude = length(vector);
  if (magnitude <= 1e-6) return { ...fallback };
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  };
}

function distanceSquared(left, right) {
  const x = left.x - right.x;
  const y = left.y - right.y;
  const z = left.z - right.z;
  return x * x + y * y + z * z;
}

function minimumLobeScale(lobe) {
  return Math.min(lobe.scale.x, lobe.scale.y, lobe.scale.z);
}

function hashUnit(seed, id, salt) {
  let value = (Number(seed) ^ Math.imul(id + 1, salt)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function calculateWeightedSlice(lobes, height) {
  let weightSum = 0;
  const center = { x: 0, y: height, z: 0 };
  let radius = 0;
  let colorMix = 0;

  for (const lobe of lobes) {
    const verticalDistance = Math.abs(lobe.position.y - height);
    const verticalRadius = Math.max(0.1, lobe.scale.y);
    const normalizedDistance = verticalDistance / verticalRadius;
    const weight =
      1 /
      Math.max(
        CANOPY_CLOSURE_CONSTANTS.verticalWeightFloor,
        normalizedDistance * normalizedDistance,
      );

    center.x += lobe.position.x * weight;
    center.z += lobe.position.z * weight;
    radius += minimumLobeScale(lobe) * weight;
    colorMix += lobe.colorMix * weight;
    weightSum += weight;
  }

  return {
    center: {
      x: center.x / weightSum,
      y: height,
      z: center.z / weightSum,
    },
    radius: radius / weightSum,
    colorMix: colorMix / weightSum,
  };
}

function findInteriorTarget(field, preferred, lobes) {
  if (field.sample(preferred) <= -CANOPY_CLOSURE_CONSTANTS.minimumFieldInset) {
    return preferred;
  }

  const nearest = [...lobes].sort(
    (left, right) =>
      distanceSquared(left.position, preferred) -
      distanceSquared(right.position, preferred),
  );

  for (const lobe of nearest) {
    if (
      field.sample(lobe.position) <=
      -CANOPY_CLOSURE_CONSTANTS.minimumFieldInset
    ) {
      return lobe.position;
    }
  }

  return nearest[0]?.position ?? preferred;
}

function moveInside(field, candidate, target) {
  let position = { ...candidate };

  for (
    let step = 0;
    step < CANOPY_CLOSURE_CONSTANTS.inwardCorrectionSteps;
    step += 1
  ) {
    if (field.sample(position) <= -CANOPY_CLOSURE_CONSTANTS.minimumFieldInset) {
      return position;
    }

    position = interpolatePoint(
      position,
      target,
      CANOPY_CLOSURE_CONSTANTS.inwardCorrectionRatio,
    );
  }

  return { ...target };
}

function createSample({ id, position, normal, scale, colorMix, role }) {
  return Object.freeze({
    id,
    position: Object.freeze(position),
    normal: Object.freeze(normalize(normal)),
    scale: Math.max(CANOPY_CLOSURE_CONSTANTS.minimumScale, scale),
    colorMix: clamp(colorMix, 0, 1),
    rotation: id * CANOPY_CLOSURE_CONSTANTS.goldenAngle,
    role,
  });
}

function createSpineSamples(treeData, field, settings, startId) {
  const samples = [];
  const minimumY = field.bounds.minimum.y + field.crownHeight * 0.08;
  const maximumY = field.bounds.maximum.y - field.crownHeight * 0.06;

  for (let slice = 0; slice < settings.spineSlices; slice += 1) {
    const heightRatio = (slice + 0.5) / settings.spineSlices;
    const height = interpolate(minimumY, maximumY, heightRatio);
    const sliceData = calculateWeightedSlice(treeData.lobes, height);
    const sliceRadius = sliceData.radius * settings.radiusRatio;
    const interiorTarget = findInteriorTarget(
      field,
      sliceData.center,
      treeData.lobes,
    );
    const baseId = startId + samples.length;
    const axisAngle =
      hashUnit(treeData.seed, baseId, 0x6d2b79f5) * Math.PI * 2;

    samples.push(
      createSample({
        id: baseId,
        position: moveInside(field, sliceData.center, interiorTarget),
        normal: {
          x: Math.cos(axisAngle),
          y: 0.2,
          z: Math.sin(axisAngle),
        },
        scale:
          sliceData.radius *
          settings.clusterScaleRatio *
          CANOPY_CLOSURE_CONSTANTS.axisScaleMultiplier,
        colorMix: sliceData.colorMix - settings.colorDrop,
        role: 'spine',
      }),
    );

    for (let ring = 0; ring < settings.spineRingCount; ring += 1) {
      const id = startId + samples.length;
      const angle =
        ring * CANOPY_CLOSURE_CONSTANTS.goldenAngle +
        hashUnit(treeData.seed, id, 0x9e3779b1) * 0.35;
      const radialBand = Math.sqrt(
        (ring + 0.5) / settings.spineRingCount,
      );
      const radialJitter =
        radialBand *
        interpolate(
          0.76,
          1.04,
          hashUnit(treeData.seed, id, 0x85ebca6b),
        );
      const candidate = {
        x: sliceData.center.x + Math.cos(angle) * sliceRadius * radialJitter,
        y:
          height +
          (hashUnit(treeData.seed, id, 0xc2b2ae35) - 0.5) *
            sliceData.radius *
            settings.axialJitter,
        z: sliceData.center.z + Math.sin(angle) * sliceRadius * radialJitter,
      };
      const position = moveInside(field, candidate, interiorTarget);

      samples.push(
        createSample({
          id,
          position,
          normal: {
            x: position.x - sliceData.center.x,
            y: (hashUnit(treeData.seed, id, 0x27d4eb2d) - 0.5) * 0.4,
            z: position.z - sliceData.center.z,
          },
          scale: sliceData.radius * settings.clusterScaleRatio,
          colorMix: sliceData.colorMix - settings.colorDrop,
          role: 'spine',
        }),
      );
    }
  }

  return samples;
}

function createBridgeSamples(treeData, field, settings, startId) {
  const samples = [];
  const sortedLobes = [...treeData.lobes].sort(
    (left, right) => left.position.y - right.position.y,
  );

  for (let index = 1; index < sortedLobes.length; index += 1) {
    const lower = sortedLobes[index - 1];
    const upper = sortedLobes[index];
    const lowerScale = minimumLobeScale(lower);
    const upperScale = minimumLobeScale(upper);
    const scale =
      Math.min(lowerScale, upperScale) *
      settings.clusterScaleRatio *
      CANOPY_CLOSURE_CONSTANTS.bridgeScaleMultiplier;

    for (let bridge = 0; bridge < settings.bridgeSamples; bridge += 1) {
      const ratio = (bridge + 1) / (settings.bridgeSamples + 1);
      const id = startId + samples.length;
      const target = interpolatePoint(lower.position, upper.position, ratio);
      const interiorTarget = findInteriorTarget(field, target, [lower, upper]);
      const angle =
        id * CANOPY_CLOSURE_CONSTANTS.goldenAngle +
        hashUnit(treeData.seed, id, 0x165667b1) * 0.5;
      const radius =
        Math.min(lowerScale, upperScale) * settings.radiusRatio * 0.32;
      const candidate = {
        x: target.x + Math.cos(angle) * radius,
        y: target.y,
        z: target.z + Math.sin(angle) * radius,
      };
      const position = moveInside(field, candidate, interiorTarget);

      samples.push(
        createSample({
          id,
          position,
          normal: {
            x: Math.cos(angle),
            y: 0.12,
            z: Math.sin(angle),
          },
          scale,
          colorMix:
            interpolate(lower.colorMix, upper.colorMix, ratio) -
            settings.colorDrop,
          role: 'bridge',
        }),
      );
    }
  }

  return samples;
}

function createCapSamples(treeData, field, settings, startId) {
  const samples = [];
  const topLobe = treeData.lobes.reduce((highest, lobe) =>
    lobe.position.y + lobe.scale.y > highest.position.y + highest.scale.y
      ? lobe
      : highest,
  );
  const capRadius = Math.min(topLobe.scale.x, topLobe.scale.z) * 0.62;

  for (let index = 0; index < settings.capSamples; index += 1) {
    const id = startId + index;
    const ratio = (index + 0.5) / settings.capSamples;
    const angle = index * CANOPY_CLOSURE_CONSTANTS.goldenAngle;
    const radialRatio = Math.sqrt(ratio) * 0.78;
    const target = {
      x: topLobe.position.x,
      y: topLobe.position.y + topLobe.scale.y * 0.22,
      z: topLobe.position.z,
    };
    const candidate = {
      x: target.x + Math.cos(angle) * capRadius * radialRatio,
      y:
        target.y +
        (1 - radialRatio) * topLobe.scale.y * 0.22 -
        hashUnit(treeData.seed, id, 0x94d049bb) * topLobe.scale.y * 0.12,
      z: target.z + Math.sin(angle) * capRadius * radialRatio,
    };
    const position = moveInside(field, candidate, topLobe.position);

    samples.push(
      createSample({
        id,
        position,
        normal: {
          x: position.x - topLobe.position.x,
          y: 0.7,
          z: position.z - topLobe.position.z,
        },
        scale:
          minimumLobeScale(topLobe) *
          settings.clusterScaleRatio *
          CANOPY_CLOSURE_CONSTANTS.capScaleMultiplier,
        colorMix: topLobe.colorMix - settings.colorDrop * 0.5,
        role: 'cap',
      }),
    );
  }

  return samples;
}

export class CanopyClosureSampler {
  generate(treeData, field) {
    const settings = treeData.palette.leafDetail.closure;
    if (!settings.enabled) return Object.freeze([]);

    const spine = createSpineSamples(treeData, field, settings, 1_000_000);
    const bridges = createBridgeSamples(
      treeData,
      field,
      settings,
      2_000_000,
    );
    const cap = createCapSamples(treeData, field, settings, 3_000_000);

    return Object.freeze([...spine, ...bridges, ...cap]);
  }
}
