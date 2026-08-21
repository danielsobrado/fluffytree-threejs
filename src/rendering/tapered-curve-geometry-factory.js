import * as THREE from 'three';
import {
  createSweepFrames,
  createSweepParameters,
} from './swept-tube-sampling.js?v=2.0.0-20260814.2';
import { TREE_STRUCTURE_RENDERING_CONSTANTS } from './tree-structure-rendering-constants.js?v=2.0.0-20260814.2';

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

function calculateRadius(startRadius, endRadius, flare, t, taperExponent) {
  const taper = Math.pow(t, taperExponent);
  const baseRadius = THREE.MathUtils.lerp(startRadius, endRadius, taper);
  const flareFactor =
    1 +
    flare *
      Math.pow(1 - t, TREE_STRUCTURE_RENDERING_CONSTANTS.flareExponent);
  return baseRadius * flareFactor;
}

function appendCap({
  center,
  tangent,
  reverse,
  positions,
  normals,
  uvs,
  indices,
  radialSegments,
  ringStart,
}) {
  const capNormal = tangent.clone().multiplyScalar(reverse ? -1 : 1).normalize();
  const centerIndex = positions.length / 3;

  positions.push(center.x, center.y, center.z);
  normals.push(capNormal.x, capNormal.y, capNormal.z);
  uvs.push(0.5, 0.5);

  for (let segment = 0; segment < radialSegments; segment += 1) {
    const current = ringStart + segment;
    const following = ringStart + ((segment + 1) % radialSegments);

    if (reverse) {
      indices.push(centerIndex, following, current);
    } else {
      indices.push(centerIndex, current, following);
    }
  }
}

export class TaperedCurveGeometryFactory {
  create({
    path,
    startRadius,
    endRadius,
    sampleCount,
    flare = 0,
    capStart = false,
    capEnd = false,
    sampleBias = 1,
    radiusScale = null,
    taperExponent = TREE_STRUCTURE_RENDERING_CONSTANTS.taperExponent,
    radialSegments = TREE_STRUCTURE_RENDERING_CONSTANTS.radialSegments,
  }) {
    if (!Array.isArray(path) || path.length < 3) {
      throw new Error('A tapered curve requires at least three path points.');
    }

    const curve = createCurve(path);
    const parameters = createSweepParameters(sampleCount, sampleBias);
    const centers = parameters.map((t) => curve.getPointAt(t));
    const tangents = parameters.map((t) => curve.getTangentAt(t).normalize());
    const frames = createSweepFrames(tangents);
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const radial = new THREE.Vector3();
    const binormalVector = new THREE.Vector3();
    let startRingMaximumHeight = Number.NEGATIVE_INFINITY;

    parameters.forEach((t, ring) => {
      const center = centers[ring];
      const radius = calculateRadius(
        startRadius,
        endRadius,
        flare,
        t,
        taperExponent,
      );
      const normal = frames.normals[ring];
      const binormal = frames.binormals[ring];
      binormalVector.set(binormal.x, binormal.y, binormal.z);

      for (let segment = 0; segment < radialSegments; segment += 1) {
        const angle = (segment / radialSegments) * Math.PI * 2;
        const scale = radiusScale
          ? radiusScale({ angle, height: center.y, t })
          : 1;
        radial
          .set(normal.x, normal.y, normal.z)
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(binormalVector, Math.sin(angle))
          .normalize();
        const y = center.y + radial.y * radius * scale;
        positions.push(
          center.x + radial.x * radius * scale,
          y,
          center.z + radial.z * radius * scale,
        );
        normals.push(radial.x, radial.y, radial.z);
        uvs.push(segment / radialSegments, t);

        if (ring === 0) {
          startRingMaximumHeight = Math.max(startRingMaximumHeight, y);
        }
      }
    });

    // Ring vertices advance with cos(angle) * normal + sin(angle) * binormal and
    // binormal = tangent x normal, so a ring walked in rising segment order is
    // clockwise when seen from outside. Each wall triangle is therefore wound
    // against that order to keep its front face pointing away from the axis.
    for (let ring = 0; ring < sampleCount; ring += 1) {
      const current = ring * radialSegments;
      const next = (ring + 1) * radialSegments;

      for (let segment = 0; segment < radialSegments; segment += 1) {
        const following = (segment + 1) % radialSegments;
        indices.push(
          current + segment,
          next + following,
          next + segment,
          current + segment,
          current + following,
          next + following,
        );
      }
    }

    if (capStart) {
      appendCap({
        center: centers[0],
        tangent: tangents[0],
        reverse: true,
        positions,
        normals,
        uvs,
        indices,
        radialSegments,
        ringStart: 0,
      });
    }

    if (capEnd) {
      appendCap({
        center: centers[sampleCount],
        tangent: tangents[sampleCount],
        reverse: false,
        positions,
        normals,
        uvs,
        indices,
        radialSegments,
        ringStart: sampleCount * radialSegments,
      });
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
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    if (radiusScale) {
      // Radial normals no longer describe a flared, buttressed sweep.
      geometry.computeVertexNormals();
    }

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.userData.sweptTube = {
      ringCount: sampleCount + 1,
      radialSegments,
      capStart,
      capEnd,
      startRingMaximumHeight,
    };
    return geometry;
  }
}
