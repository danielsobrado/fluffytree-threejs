import * as THREE from 'three';

const CARD_VERTICES = Object.freeze([
  Object.freeze([-0.5, -0.5, -0.025]),
  Object.freeze([0.5, -0.5, -0.025]),
  Object.freeze([0.5, 0.5, 0.035]),
  Object.freeze([-0.5, 0.5, 0.035]),
]);

const CARD_UVS = Object.freeze([
  Object.freeze([0, 0]),
  Object.freeze([1, 0]),
  Object.freeze([1, 1]),
  Object.freeze([0, 1]),
]);

function appendCard(buffers, cardIndex, cardCount) {
  const angle = cardCount <= 1 ? 0 : (cardIndex / cardCount) * Math.PI;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const offset = buffers.positions.length / 3;

  CARD_VERTICES.forEach((vertex, index) => {
    const x = vertex[0] * cos - vertex[1] * sin;
    const y = vertex[0] * sin + vertex[1] * cos;
    buffers.positions.push(x, y, vertex[2] + cardIndex * 0.003);
    buffers.normals.push(0, 0, 1);
    buffers.uvs.push(CARD_UVS[index][0], CARD_UVS[index][1]);
  });
  buffers.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
}

export class FoliageShellGeometryFactory {
  create(planesPerCluster) {
    const buffers = { positions: [], normals: [], uvs: [], indices: [] };
    for (let index = 0; index < planesPerCluster; index += 1) {
      appendCard(buffers, index, planesPerCluster);
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
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uvs, 2));
    geometry.setIndex(buffers.indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.name = 'foliage-shell-card-geometry';
    return geometry;
  }
}
