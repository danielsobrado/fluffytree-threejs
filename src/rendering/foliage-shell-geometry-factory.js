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

function cardRotation(cardIndex, cardCount) {
  if (cardCount <= 1 || cardIndex === 0) {
    return new THREE.Quaternion();
  }

  const axis = cardIndex % 2 === 0
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const direction = cardIndex % 2 === 0 ? -1 : 1;
  return new THREE.Quaternion().setFromAxisAngle(axis, direction * 0.52);
}

function appendCard(buffers, cardIndex, cardCount) {
  const rotation = cardRotation(cardIndex, cardCount);
  const vertexVector = new THREE.Vector3();
  const normalVector = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
  const offset = buffers.positions.length / 3;

  CARD_VERTICES.forEach((vertex, index) => {
    vertexVector.fromArray(vertex).applyQuaternion(rotation);
    buffers.positions.push(
      vertexVector.x,
      vertexVector.y,
      vertexVector.z + cardIndex * 0.003,
    );
    buffers.normals.push(normalVector.x, normalVector.y, normalVector.z);
    buffers.uvs.push(CARD_UVS[index][0], CARD_UVS[index][1]);
  });
  buffers.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
}

function requirePlaneRange(planesPerCluster, options) {
  if (!Number.isSafeInteger(planesPerCluster) || planesPerCluster < 1) {
    throw new RangeError('Foliage shell plane count must be a positive integer.');
  }

  const firstPlaneIndex = options.firstPlaneIndex ?? 0;
  const planeCount = options.planeCount ?? planesPerCluster - firstPlaneIndex;
  if (
    !Number.isSafeInteger(firstPlaneIndex) ||
    firstPlaneIndex < 0 ||
    firstPlaneIndex >= planesPerCluster
  ) {
    throw new RangeError('Foliage shell firstPlaneIndex is outside the cluster.');
  }
  if (
    !Number.isSafeInteger(planeCount) ||
    planeCount < 1 ||
    firstPlaneIndex + planeCount > planesPerCluster
  ) {
    throw new RangeError('Foliage shell plane range is outside the cluster.');
  }

  return { firstPlaneIndex, planeCount };
}

export class FoliageShellGeometryFactory {
  create(planesPerCluster, options = {}) {
    const range = requirePlaneRange(planesPerCluster, options);
    const buffers = { positions: [], normals: [], uvs: [], indices: [] };
    const lastPlaneIndex = range.firstPlaneIndex + range.planeCount;

    for (let index = range.firstPlaneIndex; index < lastPlaneIndex; index += 1) {
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
