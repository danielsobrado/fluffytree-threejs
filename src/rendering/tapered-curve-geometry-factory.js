import * as THREE from 'three';
import { TREE_STRUCTURE_RENDERING_CONSTANTS } from './tree-structure-rendering-constants.js';

function toVector3(point) {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function createCurve(points) {
  const vectors = points.map(toVector3);

  if (vectors.length === 3) {
    return new THREE.QuadraticBezierCurve3(vectors[0], vectors[1], vectors[2]);
  }

  return new THREE.CatmullRomCurve3(vectors, false, 'centripetal');
}

function calculateRadius(startRadius, endRadius, flare, t) {
  const taper = Math.pow(t, TREE_STRUCTURE_RENDERING_CONSTANTS.taperExponent);
  const baseRadius = THREE.MathUtils.lerp(startRadius, endRadius, taper);
  const flareFactor =
    1 +
    flare *
      Math.pow(1 - t, TREE_STRUCTURE_RENDERING_CONSTANTS.flareExponent);
  return baseRadius * flareFactor;
}

export class TaperedCurveGeometryFactory {
  create({ path, startRadius, endRadius, sampleCount, flare = 0 }) {
    if (!Array.isArray(path) || path.length < 3) {
      throw new Error('A tapered curve requires at least three path points.');
    }

    const curve = createCurve(path);
    const frames = curve.computeFrenetFrames(sampleCount, false);
    const positions = [];
    const normals = [];
    const indices = [];
    const center = new THREE.Vector3();
    const radial = new THREE.Vector3();
    const radialSegments = TREE_STRUCTURE_RENDERING_CONSTANTS.radialSegments;

    for (let ring = 0; ring <= sampleCount; ring += 1) {
      const t = ring / sampleCount;
      curve.getPointAt(t, center);
      const radius = calculateRadius(startRadius, endRadius, flare, t);

      for (let segment = 0; segment < radialSegments; segment += 1) {
        const angle = (segment / radialSegments) * Math.PI * 2;
        radial
          .copy(frames.normals[ring])
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(frames.binormals[ring], Math.sin(angle))
          .normalize();
        positions.push(
          center.x + radial.x * radius,
          center.y + radial.y * radius,
          center.z + radial.z * radius,
        );
        normals.push(radial.x, radial.y, radial.z);
      }
    }

    for (let ring = 0; ring < sampleCount; ring += 1) {
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

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(normals, 3),
    );
    geometry.setIndex(indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}
