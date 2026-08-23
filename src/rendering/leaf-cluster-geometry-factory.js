import * as THREE from 'three';
import { LEAF_DETAIL_RENDERING_CONSTANTS } from './leaf-detail-rendering-constants.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DIAMOND_TRIANGLES_PER_LEAF = 2;
const OVAL_TRIANGLES_PER_LEAF = 4;

function appendVertex(positions, point) {
  positions.push(point.x, point.y, point.z);
}

function createLeafFrame(index, leafCount, settings, geometryPolicy) {
  const ratio = (index + 0.5) / leafCount;
  const baseAngle = index * GOLDEN_ANGLE + (index % 3) * 0.17;
  const baseRadius = 0.08 + Math.sqrt(ratio) * 0.2;
  const embedMultiplier =
    LEAF_DETAIL_RENDERING_CONSTANTS.leafRootEmbedBaseMultiplier +
    (index % 2) *
      LEAF_DETAIL_RENDERING_CONSTANTS.leafRootEmbedAlternateMultiplier;
  const base = new THREE.Vector3(
    Math.cos(baseAngle) * baseRadius,
    -settings.embedRatio * embedMultiplier,
    Math.sin(baseAngle) * baseRadius,
  );
  const directionAngle = baseAngle + (index % 2 === 0 ? 0.48 : -0.34);
  const direction = new THREE.Vector3(
    Math.cos(directionAngle),
    0,
    Math.sin(directionAngle),
  );
  const side = new THREE.Vector3(-direction.z, 0, direction.x);
  const length =
    (0.62 + (index % 4) * 0.065) * Number(geometryPolicy?.lengthMultiplier ?? 1);
  const width =
    (0.17 + ((index + 1) % 3) * 0.022) *
    Number(geometryPolicy?.widthMultiplier ?? 1);
  const fold = settings.protrusionRatio * (0.72 + (index % 3) * 0.12);
  return { base, direction, side, length, width, fold };
}

function createDiamondLeaf(frame) {
  const shoulder = frame.base
    .clone()
    .addScaledVector(frame.direction, frame.length * 0.44);
  const left = shoulder
    .clone()
    .addScaledVector(frame.side, frame.width)
    .add(new THREE.Vector3(0, frame.fold * 0.28, 0));
  const right = shoulder
    .clone()
    .addScaledVector(frame.side, -frame.width)
    .add(new THREE.Vector3(0, frame.fold * 0.28, 0));
  const tip = frame.base
    .clone()
    .addScaledVector(frame.direction, frame.length)
    .add(new THREE.Vector3(0, frame.fold, 0));
  return [frame.base, left, tip, right];
}

function createOvalLeaf(frame, geometryPolicy) {
  const shoulderRatio = Number(geometryPolicy.shoulderRatio);
  const midRatio = Number(geometryPolicy.midRatio);
  const shoulderWidth = frame.width * Number(geometryPolicy.shoulderWidthRatio);
  const shoulder = frame.base
    .clone()
    .addScaledVector(frame.direction, frame.length * shoulderRatio)
    .add(new THREE.Vector3(0, frame.fold * 0.16, 0));
  const mid = frame.base
    .clone()
    .addScaledVector(frame.direction, frame.length * midRatio)
    .add(new THREE.Vector3(0, frame.fold * 0.44, 0));
  const tip = frame.base
    .clone()
    .addScaledVector(frame.direction, frame.length)
    .add(new THREE.Vector3(0, frame.fold, 0));

  return [
    frame.base,
    shoulder.clone().addScaledVector(frame.side, shoulderWidth),
    mid.clone().addScaledVector(frame.side, frame.width),
    tip,
    mid.clone().addScaledVector(frame.side, -frame.width),
    shoulder.clone().addScaledVector(frame.side, -shoulderWidth),
  ];
}

function appendDiamond(indices, offset) {
  indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
}

function appendOval(indices, offset) {
  indices.push(
    offset,
    offset + 1,
    offset + 2,
    offset,
    offset + 2,
    offset + 3,
    offset,
    offset + 3,
    offset + 4,
    offset,
    offset + 4,
    offset + 5,
  );
}

export class LeafClusterGeometryFactory {
  create(settings, geometryPolicy = null) {
    const positions = [];
    const indices = [];
    const leafCount = settings.leavesPerCluster;
    const oval = geometryPolicy?.shape === 'oval';

    for (let index = 0; index < leafCount; index += 1) {
      const frame = createLeafFrame(index, leafCount, settings, geometryPolicy);
      const points = oval ? createOvalLeaf(frame, geometryPolicy) : createDiamondLeaf(frame);
      const offset = positions.length / 3;

      for (const point of points) appendVertex(positions, point);
      if (oval) appendOval(indices, offset);
      else appendDiamond(indices, offset);
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
      shape: oval ? 'oval' : 'diamond',
      triangleCount:
        leafCount *
        (oval ? OVAL_TRIANGLES_PER_LEAF : DIAMOND_TRIANGLES_PER_LEAF),
    };
    return geometry;
  }
}
