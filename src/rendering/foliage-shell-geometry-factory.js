import * as THREE from 'three';
import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js';

const PLANE_VERTICES = Object.freeze([
  Object.freeze([-0.5, -0.5, 0]),
  Object.freeze([0.5, -0.5, 0]),
  Object.freeze([0.5, 0.5, 0]),
  Object.freeze([-0.5, 0.5, 0]),
]);

const PLANE_UVS = Object.freeze([
  Object.freeze([0, 0]),
  Object.freeze([1, 0]),
  Object.freeze([1, 1]),
  Object.freeze([0, 1]),
]);

function calculatePlaneAngle(index, count) {
  if (count === 1) return 0;
  const normalized = index / (count - 1);
  return (normalized * 2 - 1) * FOLIAGE_RENDERING_CONSTANTS.shellPlaneTilt;
}

function appendPlane(buffers, planeIndex, planeCount) {
  const angle = calculatePlaneAngle(planeIndex, planeCount);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const vertexOffset = buffers.positions.length / 3;

  PLANE_VERTICES.forEach((vertex, index) => {
    const x = vertex[0] * cos + vertex[2] * sin;
    const y = vertex[1] * FOLIAGE_RENDERING_CONSTANTS.shellHeightScale;
    const z = -vertex[0] * sin + vertex[2] * cos;
    buffers.positions.push(x, y, z);
    buffers.normals.push(sin, 0, cos);
    buffers.uvs.push(PLANE_UVS[index][0], PLANE_UVS[index][1]);
  });

  buffers.indices.push(
    vertexOffset,
    vertexOffset + 1,
    vertexOffset + 2,
    vertexOffset,
    vertexOffset + 2,
    vertexOffset + 3,
  );
}

export class FoliageShellGeometryFactory {
  create(planesPerCluster) {
    const buffers = {
      positions: [],
      normals: [],
      uvs: [],
      indices: [],
    };

    for (let index = 0; index < planesPerCluster; index += 1) {
      appendPlane(buffers, index, planesPerCluster);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(buffers.positions, 3),
    );
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(buffers.normals, 3),
    );
    geometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(buffers.uvs, 2),
    );
    geometry.setIndex(buffers.indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.name = 'foliage-shell-cluster-geometry';
    return geometry;
  }
}
