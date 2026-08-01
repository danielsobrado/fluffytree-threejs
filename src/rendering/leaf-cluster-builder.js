import * as THREE from 'three';
import { CrownVolumeField } from '../generation/crown-volume-field.js';
import { CanopyClosureSampler } from './canopy-closure-sampler.js';
import { hashUnit } from './canopy-closure-math.js';
import { LeafClusterGeometryFactory } from './leaf-cluster-geometry-factory.js';
import { LEAF_DETAIL_RENDERING_CONSTANTS } from './leaf-detail-rendering-constants.js';
import {
  countClosureRoles,
  createClosureRecords,
  createSurfaceRecords,
} from './leaf-cluster-record-factory.js';
import {
  calculateInstanceScale,
  getInnerInsetRatio,
  getOuterOffsetRatio,
  getTangentialJitterRatio,
  resolvePlacement,
  resolvePosition,
} from './leaf-cluster-placement.js';
import { samplePaletteColor } from './palette-color-sampler.js';

const UP = new THREE.Vector3(0, 1, 0);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function selectSamples(treeData, density) {
  return treeData.shell.filter(
    (sample) => hashUnit(treeData.seed, sample.id, 0x9e3779b1) <= density,
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
    const surfaceRecords = createSurfaceRecords(selected, settings.layerCount);
    const closureRecords = createClosureRecords(
      closureSamples,
      settings.closure.microLayerCount,
    );
    const records = [...surfaceRecords, ...closureRecords];

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

    const closureRoles = countClosureRoles(closureRecords);
    mesh.userData.leafDetail = {
      clusterCount: records.length,
      surfaceClusterCount: surfaceRecords.length,
      closureClusterCount: closureRecords.length,
      closureVolumeCount: closureRoles.volume,
      closureTrunkCount: closureRoles.trunk,
      closureSaddleCount: closureRoles.saddle,
      closureCapCount: closureRoles.cap,
      closureLayerCount: settings.closure.microLayerCount,
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
