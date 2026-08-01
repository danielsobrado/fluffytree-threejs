import * as THREE from 'three';
import { CrownVolumeField } from '../generation/crown-volume-field.js';
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

function createInstanceRecords(samples, layerCount) {
  return samples.flatMap((sample) =>
    Array.from({ length: layerCount }, (_, layer) => ({ sample, layer })),
  );
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

function calculateRadialOffset(layer, settings, instanceScale) {
  const offsetRatio = THREE.MathUtils.lerp(
    -settings.innerInsetRatio,
    settings.outerOffsetRatio,
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

function addTangentialJitter(position, normal, treeData, sample, layer, settings, scale) {
  const id = sample.id + layer * 8191;
  const angle = hashUnit(treeData.seed, id, 0x165667b1) * LEAF_DETAIL_RENDERING_CONSTANTS.tau;
  const radius =
    Math.sqrt(hashUnit(treeData.seed, id, 0xd3a2646c)) *
    settings.tangentialJitterRatio *
    scale;
  const { tangent, bitangent } = createTangentBasis(normal);
  position.addScaledVector(tangent, Math.cos(angle) * radius);
  position.addScaledVector(bitangent, Math.sin(angle) * radius);
}

export class LeafClusterBuilder {
  constructor({ geometryFactory = new LeafClusterGeometryFactory() } = {}) {
    this.geometryFactory = geometryFactory;
  }

  build(treeData) {
    const settings = treeData.palette.leafDetail;
    const selected = settings.enabled
      ? selectSamples(treeData, settings.density)
      : [];
    const records = createInstanceRecords(selected, settings.layerCount);

    if (records.length === 0) {
      const empty = new THREE.Group();
      empty.name = 'leaf-detail-shell';
      return empty;
    }

    const field = new CrownVolumeField(treeData);
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

    records.forEach(({ sample, layer }, index) => {
      const surface = projectToSurface(field, sample);
      const instanceId = sample.id + layer * 4099;
      const scaleJitter = THREE.MathUtils.lerp(
        LEAF_DETAIL_RENDERING_CONSTANTS.scaleJitterMinimum,
        LEAF_DETAIL_RENDERING_CONSTANTS.scaleJitterMaximum,
        hashUnit(treeData.seed, instanceId, 0x27d4eb2d),
      );
      const instanceScale = Math.max(
        LEAF_DETAIL_RENDERING_CONSTANTS.minimumScale,
        sample.scale *
          settings.scale *
          calculateLayerScale(layer, settings) *
          scaleJitter,
      );
      const position = surface.position
        .clone()
        .addScaledVector(
          surface.normal,
          calculateRadialOffset(layer, settings, instanceScale),
        );
      addTangentialJitter(
        position,
        surface.normal,
        treeData,
        sample,
        layer,
        settings,
        instanceScale,
      );

      alignment.setFromUnitVectors(UP, surface.normal);
      spin.setFromAxisAngle(UP, sample.rotation + layer * GOLDEN_ANGLE);
      alignment.multiply(spin);
      scale.setScalar(instanceScale);
      matrix.compose(position, alignment, scale);
      mesh.setMatrixAt(index, matrix);

      const jitter =
        (hashUnit(treeData.seed, sample.id + layer * 6151, 0x85ebca6b) *
          2 -
          1) *
        settings.colorJitter;
      mesh.setColorAt(
        index,
        samplePaletteColor(
          treeData.palette.palette,
          sample.colorMix + settings.colorLift + jitter,
        ),
      );
    });

    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.name = 'leaf-detail-shell';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.leafDetail = {
      clusterCount: records.length,
      sourceSampleCount: selected.length,
      layerCount: settings.layerCount,
      leafCount: records.length * settings.leavesPerCluster,
      innerInsetRatio: settings.innerInsetRatio,
      outerOffsetRatio: settings.outerOffsetRatio,
      tangentialJitterRatio: settings.tangentialJitterRatio,
    };
    return mesh;
  }
}
