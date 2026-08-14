import * as THREE from 'three';
import { CrownVolumeField } from '../generation/crown-volume-field.js';
import { hashUnit } from './deterministic-hash.js';
import { LeafClusterGeometryFactory } from './leaf-cluster-geometry-factory.js';
import { LEAF_DETAIL_RENDERING_CONSTANTS } from './leaf-detail-rendering-constants.js';
import { createSurfaceRecords } from './leaf-cluster-record-factory.js';
import {
  calculateInstanceScale,
  getInnerInsetRatio,
  getOuterOffsetRatio,
  getTangentialJitterRatio,
  resolvePlacement,
  resolvePosition,
} from './leaf-cluster-placement.js';
import { samplePaletteColor } from './palette-color-sampler.js';
import { configureTreeWindMaterial } from './tree-wind-shader.js';

const UP = new THREE.Vector3(0, 1, 0);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function selectSamples(treeData, density) {
  return treeData.shell.filter(
    (sample) => hashUnit(treeData.seed, sample.id, 0x9e3779b1) <= density,
  );
}

function createEmptyLeafShell(settings) {
  const empty = new THREE.Group();
  empty.name = 'hero-leaf-shell';
  empty.userData.heroLeaves = {
    clusterCount: 0,
    surfaceClusterCount: 0,
    sourceSampleCount: 0,
    layerCount: settings.layerCount,
    leafCount: 0,
    innerInsetRatio: getInnerInsetRatio(settings),
    outerOffsetRatio: getOuterOffsetRatio(settings),
    tangentialJitterRatio: getTangentialJitterRatio(settings),
  };
  return empty;
}

export class LeafClusterBuilder {
  constructor({
    geometryFactory = new LeafClusterGeometryFactory(),
  } = {}) {
    this.geometryFactory = geometryFactory;
  }

  build(treeData) {
    const settings = treeData.palette.heroLeaves;
    if (!settings.enabled || settings.density <= 0 || treeData.shell.length === 0) {
      return createEmptyLeafShell(settings);
    }

    const selected = selectSamples(treeData, settings.density);
    if (selected.length === 0) return createEmptyLeafShell(settings);

    const surfaceRecords = createSurfaceRecords(selected, settings.layerCount);
    if (surfaceRecords.length === 0) return createEmptyLeafShell(settings);

    const field = new CrownVolumeField(treeData);
    const records = surfaceRecords;
    let geometry = null;
    let material = null;

    try {
      geometry = this.geometryFactory.create(settings);
      material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness:
          settings.roughness ?? LEAF_DETAIL_RENDERING_CONSTANTS.defaultRoughness,
        metalness: LEAF_DETAIL_RENDERING_CONSTANTS.materialMetalness,
        side: THREE.FrontSide,
      });
      material.name = 'leaf-detail-material';
      configureTreeWindMaterial(material, { cacheKey: 'leaf-detail-wind-v1' });

      const mesh = new THREE.InstancedMesh(geometry, material, records.length);
      const matrix = new THREE.Matrix4();
      const alignment = new THREE.Quaternion();
      const spin = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const instanceColor = new THREE.Color();
      const placement = {
        position: new THREE.Vector3(),
        normal: new THREE.Vector3(),
      };
      const position = new THREE.Vector3();
      const tangent = new THREE.Vector3();
      const bitangent = new THREE.Vector3();

      records.forEach((record, index) => {
        resolvePlacement(record, field, placement);
        const instanceScale = calculateInstanceScale(record, settings, treeData);
        resolvePosition(
          record,
          placement,
          treeData,
          settings,
          instanceScale,
          position,
          tangent,
          bitangent,
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
            instanceColor,
          ),
        );
      });

      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.name = 'hero-leaf-shell';
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();

      mesh.userData.heroLeaves = {
        clusterCount: records.length,
        surfaceClusterCount: surfaceRecords.length,
        sourceSampleCount: selected.length,
        layerCount: settings.layerCount,
        leafCount: records.length * settings.leavesPerCluster,
        innerInsetRatio: getInnerInsetRatio(settings),
        outerOffsetRatio: getOuterOffsetRatio(settings),
        tangentialJitterRatio: getTangentialJitterRatio(settings),
      };

      geometry = null;
      material = null;
      return mesh;
    } catch (error) {
      geometry?.dispose();
      material?.dispose();
      throw error;
    }
  }
}
