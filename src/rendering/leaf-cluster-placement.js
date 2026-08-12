import * as THREE from 'three';
import { hashUnit } from './deterministic-hash.js';
import {
  calculateSurfaceLayerScale,
  calculateSurfaceRadialOffset,
  getTangentialJitterRatio,
} from './leaf-cluster-layer-layout.js';
import { LEAF_DETAIL_RENDERING_CONSTANTS } from './leaf-detail-rendering-constants.js';

export {
  getInnerInsetRatio,
  getOuterOffsetRatio,
  getTangentialJitterRatio,
} from './leaf-cluster-layer-layout.js';

const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);

function projectToSurface(field, sample) {
  const position = new THREE.Vector3(
    sample.position.x,
    sample.position.y,
    sample.position.z,
  );

  for (
    let iteration = 0;
    iteration < LEAF_DETAIL_RENDERING_CONSTANTS.projectionIterations;
    iteration += 1
  ) {
    const distance = field.sample(position);
    if (Math.abs(distance) <= LEAF_DETAIL_RENDERING_CONSTANTS.surfaceTolerance) {
      break;
    }

    const gradient = field.gradient(position);
    position.addScaledVector(
      new THREE.Vector3(gradient.x, gradient.y, gradient.z),
      -distance,
    );
  }

  const gradient = field.gradient(position);
  return {
    position,
    normal: new THREE.Vector3(gradient.x, gradient.y, gradient.z).normalize(),
  };
}

function createTangentBasis(normal) {
  const reference =
    Math.abs(normal.y) < LEAF_DETAIL_RENDERING_CONSTANTS.tangentReferenceThreshold
      ? UP
      : RIGHT;
  const tangent = new THREE.Vector3().crossVectors(reference, normal).normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  return { tangent, bitangent };
}

function addSurfaceJitter(
  position,
  normal,
  treeData,
  record,
  settings,
  instanceScale,
) {
  const id = record.sample.id + record.layer * 8191;
  const angle =
    hashUnit(treeData.seed, id, 0x165667b1) *
    LEAF_DETAIL_RENDERING_CONSTANTS.tau;
  const radius =
    Math.sqrt(hashUnit(treeData.seed, id, 0xd3a2646c)) *
    getTangentialJitterRatio(settings) *
    instanceScale;
  const { tangent, bitangent } = createTangentBasis(normal);
  position.addScaledVector(tangent, Math.cos(angle) * radius);
  position.addScaledVector(bitangent, Math.sin(angle) * radius);
}

export function resolvePlacement(record, field) {
  return projectToSurface(field, record.sample);
}

export function calculateInstanceScale(record, settings, treeData) {
  const instanceId = record.sample.id + record.layer * 4099;
  const scaleJitter = THREE.MathUtils.lerp(
    LEAF_DETAIL_RENDERING_CONSTANTS.scaleJitterMinimum,
    LEAF_DETAIL_RENDERING_CONSTANTS.scaleJitterMaximum,
    hashUnit(treeData.seed, instanceId, 0x27d4eb2d),
  );
  const layerScale = calculateSurfaceLayerScale(record.layer, settings);

  return Math.max(
    LEAF_DETAIL_RENDERING_CONSTANTS.minimumScale,
    record.sample.scale * settings.scale * layerScale * scaleJitter,
  );
}

export function resolvePosition(
  record,
  placement,
  treeData,
  settings,
  instanceScale,
) {
  const position = placement.position.clone();

  position.addScaledVector(
    placement.normal,
    calculateSurfaceRadialOffset(record.layer, settings, instanceScale),
  );
  addSurfaceJitter(
    position,
    placement.normal,
    treeData,
    record,
    settings,
    instanceScale,
  );
  return position;
}
