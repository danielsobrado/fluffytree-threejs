import { CANOPY_CLOSURE_CONSTANTS } from './canopy-closure-constants.js';
import { moveInside } from './canopy-cross-section.js';
import { createClosureSample } from './canopy-closure-sample.js';
import {
  distanceSquared,
  hashUnit,
  interpolatePoint,
  normalize,
  randomDirection,
} from './canopy-closure-math.js';

const UP = Object.freeze({ x: 0, y: 1, z: 0 });
const RIGHT = Object.freeze({ x: 1, y: 0, z: 0 });

function minimumScale(lobe) {
  return Math.min(lobe.scale.x, lobe.scale.y, lobe.scale.z);
}

function cross(left, right) {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function createBasis(direction) {
  const reference = Math.abs(direction.y) < 0.9 ? UP : RIGHT;
  const tangent = normalize(cross(reference, direction));
  const bitangent = normalize(cross(direction, tangent));
  return { tangent, bitangent };
}

function createPairs(lobes) {
  const pairs = new Map();

  for (const lobe of lobes) {
    const nearest = lobes
      .filter((candidate) => candidate.id !== lobe.id)
      .map((candidate) => ({
        candidate,
        distanceSquared: distanceSquared(lobe.position, candidate.position),
      }))
      .sort((left, right) => left.distanceSquared - right.distanceSquared)
      .slice(0, CANOPY_CLOSURE_CONSTANTS.saddleMaximumNeighborsPerLobe);

    for (const neighbor of nearest) {
      const combinedRadius =
        minimumScale(lobe) + minimumScale(neighbor.candidate);
      const maximumDistance =
        combinedRadius *
        CANOPY_CLOSURE_CONSTANTS.saddleNeighborDistanceMultiplier;
      if (neighbor.distanceSquared > maximumDistance * maximumDistance) continue;

      const ids = [lobe.id, neighbor.candidate.id].sort(
        (left, right) => left - right,
      );
      pairs.set(`${ids[0]}:${ids[1]}`, [lobe, neighbor.candidate]);
    }
  }

  return [...pairs.values()];
}

export class CanopySaddleSampler {
  generate(treeData, field, settings, startId = 3_000_000) {
    const samples = [];

    for (const [left, right] of createPairs(treeData.lobes)) {
      const minimumRadius = Math.min(
        minimumScale(left),
        minimumScale(right),
      );
      const direction = normalize({
        x: right.position.x - left.position.x,
        y: right.position.y - left.position.y,
        z: right.position.z - left.position.z,
      });
      const { tangent, bitangent } = createBasis(direction);
      const maximumDistance =
        minimumRadius * CANOPY_CLOSURE_CONSTANTS.saddleOutsideDistanceRatio;

      for (let index = 0; index < settings.saddleSamples; index += 1) {
        const ratio = (index + 1) / (settings.saddleSamples + 1);
        const id = startId + samples.length;
        const target = interpolatePoint(left.position, right.position, ratio);
        const angle =
          index * CANOPY_CLOSURE_CONSTANTS.goldenAngle +
          hashUnit(treeData.seed, id, 0xd3a2646c) * 0.45;
        const radius =
          minimumRadius *
          settings.radiusRatio *
          0.24 *
          Math.sqrt((index + 0.5) / settings.saddleSamples);
        const candidate = {
          x:
            target.x +
            tangent.x * Math.cos(angle) * radius +
            bitangent.x * Math.sin(angle) * radius,
          y:
            target.y +
            tangent.y * Math.cos(angle) * radius +
            bitangent.y * Math.sin(angle) * radius,
          z:
            target.z +
            tangent.z * Math.cos(angle) * radius +
            bitangent.z * Math.sin(angle) * radius,
        };
        const position = moveInside(field, candidate, target, maximumDistance);
        if (!position) continue;

        samples.push(
          createClosureSample({
            id,
            position,
            normal: randomDirection(treeData.seed, id, 0.05),
            scale:
              minimumRadius *
              settings.clusterScaleRatio *
              CANOPY_CLOSURE_CONSTANTS.saddleScaleMultiplier,
            colorMix:
              left.colorMix + (right.colorMix - left.colorMix) * ratio -
              settings.colorDrop,
            role: 'saddle',
          }),
        );
      }
    }

    return Object.freeze(samples);
  }
}
