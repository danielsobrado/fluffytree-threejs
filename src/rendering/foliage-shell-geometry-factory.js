import * as THREE from 'three';
import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js';

const FIN_VERTICES = Object.freeze([
  Object.freeze([-0.5, 0, FOLIAGE_RENDERING_CONSTANTS.shellRootInset]),
  Object.freeze([0.5, 0, FOLIAGE_RENDERING_CONSTANTS.shellRootInset]),
  Object.freeze([FOLIAGE_RENDERING_CONSTANTS.shellTipWidth, 0, 1]),
  Object.freeze([-FOLIAGE_RENDERING_CONSTANTS.shellTipWidth, 0, 1]),
]);

const FIN_UVS = Object.freeze([
  Object.freeze([0, 0]),
  Object.freeze([1, 0]),
  Object.freeze([1, 1]),
  Object.freeze([0, 1]),
]);

function calculatePlaneAngle(index, count) {
  if (count === 1) return 0;
  return (index / count) * Math.PI;
}

function appendFin(buffers, planeIndex, planeCount) {
  const angle = calculatePlaneAngle(planeIndex, planeCount);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const vertexOffset = buffers.positions.length / 3;

  FIN_VERTICES.forEach((vertex, index) => {
    const x = vertex[0] * cos;
    const y = vertex[0] * sin;
    buffers.positions.push(x, y, vertex[2]);
    buffers.normals.push(-sin, cos, 0);
    buffers.uvs.push(FIN_UVS[index][0], FIN_UVS[index][1]);
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
      appendFin(buffers, index, planesPerCluster);
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
    geometry.name = 'foliage-shell-fin-geometry';
    return geometry;
  }
}
