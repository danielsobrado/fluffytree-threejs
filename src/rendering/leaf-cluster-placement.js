import * as THREE from 'three';
import { hashUnit } from './deterministic-hash.js?v=2.0.0-20260814.2';
import {
  calculateSurfaceLayerScale,
  calculateSurfaceRadialOffset,
  getTangentialJitterRatio,
} from './leaf-cluster-layer-layout.js?v=2.0.0-20260814.2';
import { LEAF_DETAIL_RENDERING_CONSTANTS } from './leaf-detail-rendering-constants.js?v=2.0.0-20260814.2';

export {
  getInnerInsetRatio,
  getOuterOffsetRatio,
  getTangentialJitterRatio,
} from './leaf-cluster-layer-layout.js';

const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);

function createPlacementTarget() {
  return {
    position: new THREE.Vector3(),
    normal: new THREE.Vector3(),
  };
}

function projectToSurface(field, sample, target) {
  const position = target.position;
  const normal = target.normal;
  position.set(sample.position.x, sample.position.y, sample.position.z);

  for (
    let iteration = 0;
    iteration < LEAF_DETAIL_RENDERING_CONSTANTS.projectionIterations;
    iteration += 1
  ) {
    const distance = field.sample(position);
    if (Math.abs(distance) <= LEAF_DETAIL_RENDERING_CONSTANTS.surfaceTolerance) {
      break;
    }

    field.gradient(position, normal);
    position.addScaledVector(normal, -distance);
  }

  field.gradient(position, normal);
  return target;
}

function createTangentBasis(normal, tangent, bitangent) {
  const reference =
    Math.abs(normal.y) < LEAF_DETAIL_RENDERING_CONSTANTS.tangentReferenceThreshold
      ? UP
      : RIGHT;
  tangent.crossVectors(reference, normal).normalize();
  bitangent.crossVectors(normal, tangent).normalize();
}

function addSurfaceJitter(
  position,
  normal,
  treeData,
  record,
  settings,
  instanceScale,
  tangent,
  bitangent,
) {
  const id = record.sample.id + record.layer * 8191;
  const angle =
    hashUnit(treeData.seed, id, 0x165667b1) *
    LEAF_DETAIL_RENDERING_CONSTANTS.tau;
  const radius =
    Math.sqrt(hashUnit(treeData.seed, id, 0xd3a2646c)) *
    getTangentialJitterRatio(settings) *
    instanceScale;
  createTangentBasis(normal, tangent, bitangent);
  position.addScaledVector(tangent, Math.cos(angle) * radius);
  position.addScaledVector(bitangent, Math.sin(angle) * radius);
}

export function resolvePlacement(
  record,
  field,
  target = createPlacementTarget(),
) {
  return projectToSurface(field, record.sample, target);
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
  target = new THREE.Vector3(),
  tangent = new THREE.Vector3(),
  bitangent = new THREE.Vector3(),
) {
  const position = target.copy(placement.position);

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
    tangent,
    bitangent,
  );
  return position;
}
