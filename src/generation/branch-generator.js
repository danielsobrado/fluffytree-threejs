import { GENERATION_CONSTANTS } from './generation-constants.js';
import { ellipsoidSupportRadius, normalizeVector } from './lobe-geometry.js';

function lerp(minimum, maximum, t) {
  return minimum + (maximum - minimum) * t;
}

function distanceFromAxis(lobe) {
  return Math.hypot(lobe.position.x, lobe.position.z);
}

function createTrunkPoint(preset, random, index) {
  const { trunk, crown } = preset;
  const t = index / trunk.segments;
  const y = lerp(0, crown.baseHeight + crown.height * 0.48, t);
  const primaryBend = Math.sin(t * Math.PI * 0.92) * trunk.bend;
  const secondaryBend = Math.sin(t * Math.PI * 2.15) * trunk.bend * 0.14;

  return {
    x:
      crown.lean[0] * t +
      primaryBend * (0.64 + random.signed() * 0.08) +
      secondaryBend,
    y,
    z:
      crown.lean[1] * t +
      primaryBend * (0.28 + random.signed() * 0.07) -
      secondaryBend * 0.55,
    radius: lerp(trunk.baseRadius, trunk.topRadius, Math.pow(t, 0.78)),
  };
}

function findTrunkAttachment(trunkPoints, targetY) {
  let best = trunkPoints[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const point of trunkPoints) {
    const distance = Math.abs(point.y - targetY);

    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }

  return best;
}

function selectBranchTargets(lobes, count) {
  return [...lobes]
    .filter((lobe) => lobe.position.y > 1)
    .sort((left, right) => {
      const radialDifference = distanceFromAxis(right) - distanceFromAxis(left);
      return Math.abs(radialDifference) > 0.05
        ? radialDifference
        : right.position.y - left.position.y;
    })
    .slice(0, count);
}

function createEmbeddedEndpoint(start, lobe) {
  const towardStart = normalizeVector({
    x: start.x - lobe.position.x,
    y: start.y - lobe.position.y,
    z: start.z - lobe.position.z,
  });
  const supportRadius = ellipsoidSupportRadius(lobe.scale, towardStart);
  const insertionDistance =
    supportRadius * GENERATION_CONSTANTS.branchInsertionDepth;

  return {
    x: lobe.position.x + towardStart.x * insertionDistance,
    y: lobe.position.y + towardStart.y * insertionDistance,
    z: lobe.position.z + towardStart.z * insertionDistance,
  };
}

function createBranchControls(start, end, random) {
  const offsetX = random.signed() * 0.14;
  const offsetZ = random.signed() * 0.14;

  return [
    {
      x: lerp(start.x, end.x, 0.3) + offsetX,
      y: lerp(start.y, end.y, 0.3) + random.range(0.12, 0.3),
      z: lerp(start.z, end.z, 0.3) + offsetZ,
    },
    {
      x: lerp(start.x, end.x, 0.72) - offsetX * 0.35,
      y: lerp(start.y, end.y, 0.72) + random.range(0.08, 0.24),
      z: lerp(start.z, end.z, 0.72) - offsetZ * 0.35,
    },
  ];
}

export class BranchGenerator {
  generate(preset, lobes, random) {
    const trunkPoints = [];

    for (let index = 0; index <= preset.trunk.segments; index += 1) {
      trunkPoints.push(createTrunkPoint(preset, random, index));
    }

    const branchTargets = selectBranchTargets(lobes, preset.trunk.branchCount);
    const branches = branchTargets.map((lobe, index) => {
      const attachmentHeight = Math.max(
        preset.crown.baseHeight * 0.68,
        lobe.position.y - preset.crown.height * random.range(0.24, 0.42),
      );
      const start = findTrunkAttachment(trunkPoints, attachmentHeight);
      const end = createEmbeddedEndpoint(start, lobe);
      const controls = createBranchControls(start, end, random);

      return {
        id: index,
        targetLobeId: lobe.id,
        points: [
          { x: start.x, y: start.y, z: start.z },
          ...controls,
          end,
        ],
        startRadius: Math.max(preset.trunk.topRadius, start.radius * 0.66),
        endRadius: Math.max(0.035, preset.trunk.topRadius * 0.3),
      };
    });

    return {
      trunk: {
        points: trunkPoints.map(({ x, y, z }) => ({ x, y, z })),
        startRadius: preset.trunk.baseRadius,
        endRadius: preset.trunk.topRadius,
        flare: preset.trunk.flare,
      },
      branches,
    };
  }
}
