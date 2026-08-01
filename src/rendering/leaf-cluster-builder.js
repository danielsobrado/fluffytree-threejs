import * as THREE from 'three';
import { CrownVolumeField } from '../generation/crown-volume-field.js';
import { CanopyClosureSampler } from './canopy-closure-sampler.js';
import { LeafClusterGeometryFactory } from './leaf-cluster-geometry-factory.js';
import { LEAF_DETAIL_RENDERING_CONSTANTS } from './leaf-detail-rendering-constants.js';
import { samplePaletteColor } from './palette-color-sampler.js';

const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function hashUnit(seed, id, salt) {
  let value = (Number(seed) ^ Math.imul(id + 1, salt)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

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

function selectSamples(treeData, density) {
  return treeData.shell.filter(
    (sample) => hashUnit(treeData.seed, sample.id, 0x9e3779b1) <= density,
  );
}

function createSurfaceRecords(samples, layerCount) {
  return samples.flatMap((sample) =>
    Array.from({ length: layerCount }, (_, layer) => ({
      sample,
      layer,
      kind: 'surface',
    })),
  );
}

function createClosureRecords(samples) {
  return samples.map((sample) => ({
    sample,
    layer: 0,
    kind: 'closure',
  }));
}

function calculateLayerRatio(layer, settings) {
  return settings.layerCount <= 1 ? 0.5 : layer / (settings.layerCount - 1);
}

function calculateLayerScale(layer, settings) {
  return THREE.MathUtils.lerp(
    LEAF_DETAIL_RENDERING_CONSTANTS.innerLayerScale,
    LEAF_DETAIL_RENDERING_CONSTANTS.outerLayerScale,
    calculateLayerRatio(layer, settings),
  );
}

function getInnerInsetRatio(settings) {
  return (
    settings.layerOffsetRatio *
    LEAF_DETAIL_RENDERING_CONSTANTS.innerInsetMultiplier
  );
}

function getOuterOffsetRatio(settings) {
  return (
    settings.layerOffsetRatio *
    LEAF_DETAIL_RENDERING_CONSTANTS.outerOffsetMultiplier
  );
}

function getTangentialJitterRatio(settings) {
  return (
    settings.layerOffsetRatio *
    LEAF_DETAIL_RENDERING_CONSTANTS.tangentialJitterMultiplier
  );
}

function calculateRadialOffset(layer, settings, instanceScale) {
  const offsetRatio = THREE.MathUtils.lerp(
    -getInnerInsetRatio(settings),
    getOuterOffsetRatio(settings),
    calculateLayerRatio(layer, settings),
  );
  return offsetRatio * instanceScale;
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

function addTangentialJitter(
  position,
  normal,
  treeData,
  sample,
  layer,
  settings,
  scale,
) {
  const id = sample.id + layer * 8191;
  const angle =
    hashUnit(treeData.seed, id, 0x165667b1) *
    LEAF_DETAIL_RENDERING_CONSTANTS.tau;
  const radius =
    Math.sqrt(hashUnit(treeData.seed, id, 0xd3a2646c)) *
    getTangentialJitterRatio(settings) *
    scale;
  const { tangent, bitangent } = createTangentBasis(normal);
  position.addScaledVector(tangent, Math.cos(angle) * radius);
  position.addScaledVector(bitangent, Math.sin(angle) * radius);
}

function resolvePlacement(record, field) {
  if (record.kind === 'closure') {
    return {
      position: new THREE.Vector3(
        record.sample.position.x,
        record.sample.position.y,
        record.sample.position.z,
      ),
      normal: new THREE.Vector3(
        record.sample.normal.x,
        record.sample.normal.y,
        record.sample.normal.z,
      ).normalize(),
    };
  }

  return projectToSurface(field, record.sample);
}

function resolvePosition(
  record,
  placement,
  treeData,
  settings,
  instanceScale,
) {
  const position = placement.position.clone();
  if (record.kind === 'closure') return position;

  position.addScaledVector(
    placement.normal,
    calculateRadialOffset(record.layer, settings, instanceScale),
  );
  addTangentialJitter(
    position,
    placement.normal,
    treeData,
    record.sample,
    record.layer,
    settings,
    instanceScale,
  );
  return position;
}

function calculateInstanceScale(record, settings, treeData) {
  const instanceId = record.sample.id + record.layer * 4099;
  const scaleJitter = THREE.MathUtils.lerp(
    LEAF_DETAIL_RENDERING_CONSTANTS.scaleJitterMinimum,
    LEAF_DETAIL_RENDERING_CONSTANTS.scaleJitterMaximum,
    hashUnit(treeData.seed, instanceId, 0x27d4eb2d),
  );
  const layerScale =
    record.kind === 'surface'
      ? calculateLayerScale(record.layer, settings)
      : 1;

  return Math.max(
    LEAF_DETAIL_RENDERING_CONSTANTS.minimumScale,
    record.sample.scale * settings.scale * layerScale * scaleJitter,
  );
}

function countClosureRoles(samples) {
  return samples.reduce(
    (counts, sample) => {
      counts[sample.role] = (counts[sample.role] ?? 0) + 1;
      return counts;
    },
    { spine: 0, bridge: 0, cap: 0 },
  );
}

export class LeafClusterBuilder {
  constructor({
    geometryFactory = new LeafClusterGeometryFactory(),
    closureSampler = new CanopyClosureSampler(),
  } = {}) {
    this.geometryFactory = geometryFactory;
    this.closureSampler = closureSampler;
  }

  build(treeData) {
    const settings = treeData.palette.leafDetail;
    const selected = settings.enabled
      ? selectSamples(treeData, settings.density)
      : [];
    const field = new CrownVolumeField(treeData);
    const closureSamples = settings.enabled
      ? this.closureSampler.generate(treeData, field)
      : [];
    const records = [
      ...createSurfaceRecords(selected, settings.layerCount),
      ...createClosureRecords(closureSamples),
    ];

    if (records.length === 0) {
      const empty = new THREE.Group();
      empty.name = 'leaf-detail-shell';
      return empty;
    }

    const geometry = this.geometryFactory.create(settings);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness:
        settings.roughness ?? LEAF_DETAIL_RENDERING_CONSTANTS.defaultRoughness,
      metalness: LEAF_DETAIL_RENDERING_CONSTANTS.materialMetalness,
      side: THREE.DoubleSide,
    });
    material.name = 'leaf-detail-material';

    const mesh = new THREE.InstancedMesh(geometry, material, records.length);
    const matrix = new THREE.Matrix4();
    const alignment = new THREE.Quaternion();
    const spin = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    records.forEach((record, index) => {
      const placement = resolvePlacement(record, field);
      const instanceScale = calculateInstanceScale(record, settings, treeData);
      const position = resolvePosition(
        record,
        placement,
        treeData,
        settings,
        instanceScale,
      );

      alignment.setFromUnitVectors(UP, placement.normal);
      spin.setFromAxisAngle(
        UP,
        record.sample.rotation + record.layer * GOLDEN_ANGLE,
      );
      alignment.multiply(spin);
      scale.setScalar(instanceScale);
      matrix.compose(position, alignment, scale);
      mesh.setMatrixAt(index, matrix);

      const jitter =
        (hashUnit(
          treeData.seed,
          record.sample.id + record.layer * 6151,
          0x85ebca6b,
        ) *
          2 -
          1) *
        settings.colorJitter;
      mesh.setColorAt(
        index,
        samplePaletteColor(
          treeData.palette.palette,
          record.sample.colorMix + settings.colorLift + jitter,
        ),
      );
    });

    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.name = 'leaf-detail-shell';
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const closureRoles = countClosureRoles(closureSamples);
    const surfaceClusterCount = selected.length * settings.layerCount;
    mesh.userData.leafDetail = {
      clusterCount: records.length,
      surfaceClusterCount,
      closureClusterCount: closureSamples.length,
      closureSpineCount: closureRoles.spine,
      closureBridgeCount: closureRoles.bridge,
      closureCapCount: closureRoles.cap,
      sourceSampleCount: selected.length,
      layerCount: settings.layerCount,
      leafCount: records.length * settings.leavesPerCluster,
      innerInsetRatio: getInnerInsetRatio(settings),
      outerOffsetRatio: getOuterOffsetRatio(settings),
      tangentialJitterRatio: getTangentialJitterRatio(settings),
    };
    return mesh;
  }
}
