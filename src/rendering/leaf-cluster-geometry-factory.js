import * as THREE from 'three';
import { LEAF_DETAIL_RENDERING_CONSTANTS } from './leaf-detail-rendering-constants.js';

function appendVertex(positions, point) {
  positions.push(point.x, point.y, point.z);
}

function createLeafPoints(angle, index, settings) {
  const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const side = new THREE.Vector3(-direction.z, 0, direction.x);
  const lengthVariation = 0.9 + (index % 3) * 0.06;
  const widthVariation = 0.9 + ((index + 1) % 2) * 0.14;
  const base = direction
    .clone()
    .multiplyScalar(0.04)
    .add(new THREE.Vector3(0, -settings.embedRatio, 0));
  const middle = direction.clone().multiplyScalar(0.36 * lengthVariation);
  const left = middle
    .clone()
    .addScaledVector(side, 0.15 * widthVariation)
    .add(new THREE.Vector3(0, settings.protrusionRatio * 0.34, 0));
  const right = middle
    .clone()
    .addScaledVector(side, -0.15 * widthVariation)
    .add(new THREE.Vector3(0, settings.protrusionRatio * 0.34, 0));
  const tip = direction
    .clone()
    .multiplyScalar(0.7 * lengthVariation)
    .add(new THREE.Vector3(0, settings.protrusionRatio, 0));
  const ridge = direction
    .clone()
    .multiplyScalar(0.34 * lengthVariation)
    .add(new THREE.Vector3(0, settings.protrusionRatio * 0.78, 0));
  return { base, left, tip, right, ridge };
}

export class LeafClusterGeometryFactory {
  create(settings) {
    const positions = [];
    const indices = [];
    const leafCount = settings.leavesPerCluster;

    for (let index = 0; index < leafCount; index += 1) {
      const angle =
        (index / leafCount) * LEAF_DETAIL_RENDERING_CONSTANTS.tau +
        (index % 2) * 0.13;
      const points = createLeafPoints(angle, index, settings);
      const offset = positions.length / 3;

      appendVertex(positions, points.base);
      appendVertex(positions, points.left);
      appendVertex(positions, points.tip);
      appendVertex(positions, points.right);
      appendVertex(positions, points.ridge);
      indices.push(
        offset,
        offset + 1,
        offset + 4,
        offset + 1,
        offset + 2,
        offset + 4,
        offset + 2,
        offset + 3,
        offset + 4,
        offset + 3,
        offset,
        offset + 4,
      );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.name = 'leaf-cluster-geometry';
    return geometry;
  }
}
