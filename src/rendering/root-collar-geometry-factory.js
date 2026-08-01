import * as THREE from 'three';
import { TREE_STRUCTURE_RENDERING_CONSTANTS } from './tree-structure-rendering-constants.js';

const TAU = Math.PI * 2;

function interpolate(left, right, ratio) {
  return left + (right - left) * ratio;
}

function pointAtHeight(path, height) {
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];

    if (current.y < height) continue;

    const span = Math.max(1e-6, current.y - previous.y);
    const ratio = THREE.MathUtils.clamp((height - previous.y) / span, 0, 1);
    return {
      x: interpolate(previous.x, current.x, ratio),
      y: height,
      z: interpolate(previous.z, current.z, ratio),
    };
  }

  const last = path.at(-1);
  return { x: last.x, y: last.y, z: last.z };
}

function createRingCenter(path, minimumY, maximumY, ratio) {
  return pointAtHeight(path, interpolate(minimumY, maximumY, ratio));
}

function calculateRadius(startRadius, flare, ratio) {
  const broadBase = startRadius * (1 + flare * 1.45);
  const collarTop = startRadius * (1 + flare * 0.18);
  return interpolate(broadBase, collarTop, Math.pow(ratio, 0.72));
}

function calculateButtress(angle, ratio, seed) {
  const phase = (((Number(seed) >>> 0) % 997) / 997) * TAU;
  const wave = Math.max(
    0,
    Math.cos(
      angle * TREE_STRUCTURE_RENDERING_CONSTANTS.rootButtressCount + phase,
    ),
  );
  const groundWeight = Math.sin(Math.PI * Math.min(1, ratio * 1.35));
  return (
    1 +
    wave *
      wave *
      TREE_STRUCTURE_RENDERING_CONSTANTS.rootButtressStrength *
      groundWeight
  );
}

function appendBottomCap(positions, indices, radialSegments) {
  const centerIndex = positions.length / 3;
  const centerX = positions[0];
  const centerY = positions[1];
  const centerZ = positions[2];
  positions.push(centerX, centerY, centerZ);

  for (let segment = 0; segment < radialSegments; segment += 1) {
    const next = (segment + 1) % radialSegments;
    indices.push(centerIndex, next, segment);
  }
}

export function trimPathAboveHeight(path, height) {
  const start = pointAtHeight(path, height);
  const remaining = path.filter((point) => point.y > height);
  const result = [start, ...remaining.map((point) => ({ ...point }))];

  if (result.length < 3) {
    throw new Error('The trunk path is too short above the root collar.');
  }

  return result;
}

export class RootCollarGeometryFactory {
  create({ path, startRadius, flare, seed }) {
    if (!Array.isArray(path) || path.length < 3) {
      throw new Error('A root collar requires at least three trunk path points.');
    }

    const radialSegments = TREE_STRUCTURE_RENDERING_CONSTANTS.radialSegments;
    const ringCount = TREE_STRUCTURE_RENDERING_CONSTANTS.rootCollarRings;
    const minimumY = -TREE_STRUCTURE_RENDERING_CONSTANTS.rootEmbedDepth;
    const maximumY = TREE_STRUCTURE_RENDERING_CONSTANTS.rootCollarHeight;
    const positions = [];
    const indices = [];

    for (let ring = 0; ring <= ringCount; ring += 1) {
      const ratio = ring / ringCount;
      const center = createRingCenter(path, minimumY, maximumY, ratio);
      const radius = calculateRadius(startRadius, flare, ratio);

      for (let segment = 0; segment < radialSegments; segment += 1) {
        const angle = (segment / radialSegments) * TAU;
        const localRadius = radius * calculateButtress(angle, ratio, seed);
        positions.push(
          center.x + Math.cos(angle) * localRadius,
          interpolate(minimumY, maximumY, ratio),
          center.z + Math.sin(angle) * localRadius,
        );
      }
    }

    for (let ring = 0; ring < ringCount; ring += 1) {
      const current = ring * radialSegments;
      const next = (ring + 1) * radialSegments;

      for (let segment = 0; segment < radialSegments; segment += 1) {
        const following = (segment + 1) % radialSegments;
        indices.push(
          current + segment,
          next + segment,
          next + following,
          current + segment,
          next + following,
          current + following,
        );
      }
    }

    appendBottomCap(positions, indices, radialSegments);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.userData.rootCollar = {
      embeddedDepth: TREE_STRUCTURE_RENDERING_CONSTANTS.rootEmbedDepth,
      collarHeight: TREE_STRUCTURE_RENDERING_CONSTANTS.rootCollarHeight,
      capped: true,
    };
    return geometry;
  }
}
