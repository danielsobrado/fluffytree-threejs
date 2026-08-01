import { GENERATION_CONSTANTS } from './generation-constants.js';
import { ellipsoidSupportRadius, normalizeVector } from './lobe-geometry.js';

function lerp(min, max, t) {
  return min + (max - min) * t;
}

function distanceFromAxis(lobe) {
  return Math.hypot(lobe.position.x, lobe.position.z);
}

function createTrunkPoint(preset, random, index) {
  const { trunk, crown } = preset;
  const t = index / trunk.segments;
  const y = lerp(0, crown.baseHeight + crown.height * 0.58, t);
  const bend = Math.sin(t * Math.PI) * trunk.bend;

  return {
    x: crown.lean[0] * t + bend * (0.62 + random.signed() * 0.12),
    y,
    z: crown.lean[1] * t + bend * (0.24 + random.signed() * 0.1),
    radius: lerp(trunk.baseRadius, trunk.topRadius, Math.pow(t, 0.82)),
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

export class BranchGenerator {
  generate(preset, lobes, random) {
    const trunkPoints = [];

    for (let index = 0; index <= preset.trunk.segments; index += 1) {
      trunkPoints.push(createTrunkPoint(preset, random, index));
    }

    const branchTargets = selectBranchTargets(lobes, preset.trunk.branchCount);
    const branches = branchTargets.map((lobe, index) => {
      const attachmentHeight = Math.max(
        preset.crown.baseHeight * 0.7,
        lobe.position.y - preset.crown.height * random.range(0.22, 0.4),
      );
      const start = findTrunkAttachment(trunkPoints, attachmentHeight);
      const end = createEmbeddedEndpoint(start, lobe);
      const control = {
        x: lerp(start.x, end.x, 0.46) + random.signed() * 0.12,
        y: lerp(start.y, end.y, 0.54) + random.range(0.08, 0.28),
        z: lerp(start.z, end.z, 0.46) + random.signed() * 0.12,
      };

      return {
        id: index,
        targetLobeId: lobe.id,
        points: [
          { x: start.x, y: start.y, z: start.z },
          control,
          end,
        ],
        startRadius: Math.max(preset.trunk.topRadius, start.radius * 0.62),
        endRadius: Math.max(0.035, preset.trunk.topRadius * 0.32),
      };
    });

    return {
      trunk: {
        points: trunkPoints.map(({ x, y, z }) => ({ x, y, z })),
        startRadius: preset.trunk.baseRadius,
        endRadius: preset.trunk.topRadius,
      },
      branches,
    };
  }
}
