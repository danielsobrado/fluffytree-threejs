import * as THREE from 'three';
import { LEAF_DETAIL_RENDERING_CONSTANTS } from './leaf-detail-rendering-constants.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function appendVertex(positions, point) {
  positions.push(point.x, point.y, point.z);
}

function createLeafPoints(index, leafCount, settings) {
  const ratio = (index + 0.5) / leafCount;
  const baseAngle = index * GOLDEN_ANGLE + (index % 3) * 0.17;
  const baseRadius = 0.08 + Math.sqrt(ratio) * 0.2;
  const baseCenter = new THREE.Vector3(
    Math.cos(baseAngle) * baseRadius,
    -settings.embedRatio * (0.78 + (index % 2) * 0.18),
    Math.sin(baseAngle) * baseRadius,
  );
  const directionAngle = baseAngle + (index % 2 === 0 ? 0.48 : -0.34);
  const direction = new THREE.Vector3(
    Math.cos(directionAngle),
    0,
    Math.sin(directionAngle),
  );
  const side = new THREE.Vector3(-direction.z, 0, direction.x);
  const length = 0.62 + (index % 4) * 0.065;
  const width = 0.17 + ((index + 1) % 3) * 0.022;
  const fold = settings.protrusionRatio * (0.72 + (index % 3) * 0.12);
  const base = baseCenter.clone();
  const shoulder = baseCenter.clone().addScaledVector(direction, length * 0.44);
  const left = shoulder
    .clone()
    .addScaledVector(side, width)
    .add(new THREE.Vector3(0, fold * 0.28, 0));
  const right = shoulder
    .clone()
    .addScaledVector(side, -width)
    .add(new THREE.Vector3(0, fold * 0.28, 0));
  const tip = baseCenter
    .clone()
    .addScaledVector(direction, length)
    .add(new THREE.Vector3(0, fold, 0));
  return { base, left, tip, right };
}

export class LeafClusterGeometryFactory {
  create(settings) {
    const positions = [];
    const indices = [];
    const leafCount = settings.leavesPerCluster;

    for (let index = 0; index < leafCount; index += 1) {
      const points = createLeafPoints(index, leafCount, settings);
      const offset = positions.length / 3;

      appendVertex(positions, points.base);
      appendVertex(positions, points.left);
      appendVertex(positions, points.tip);
      appendVertex(positions, points.right);
      indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
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
    geometry.userData.heroLeaves = {
      leavesPerCluster: leafCount,
      triangleCount: leafCount * 2,
    };
    return geometry;
  }
}
