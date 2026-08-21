import * as THREE from 'three';
import { CrownVolumeField } from '../generation/crown-volume-field.js?v=2.0.0-20260814.2';
import {
  calculateHeroClusterStretch,
  calculateHeroLeafColorMix,
  calculateHeroLeafPaletteCoordinate,
  selectHeroLeafSamples,
} from './hero-leaf-style.js?v=2.0.0-20260814.2';
import { HeroLeafMaterialFactory } from './hero-leaf-material-factory.js?v=2.0.0-20260814.2';
import { addFoliageInstanceAttributes } from './instanced-foliage-attributes.js?v=2.0.0-20260814.2';
import { LeafClusterGeometryFactory } from './leaf-cluster-geometry-factory.js?v=2.0.0-20260814.2';
import { LEAF_DETAIL_RENDERING_CONSTANTS } from './leaf-detail-rendering-constants.js?v=2.0.0-20260814.2';
import { createSurfaceRecords } from './leaf-cluster-record-factory.js?v=2.0.0-20260814.2';
import {
  calculateInstanceScale,
  getInnerInsetRatio,
  getOuterOffsetRatio,
  getTangentialJitterRatio,
  resolvePlacement,
  resolvePosition,
} from './leaf-cluster-placement.js?v=2.0.0-20260814.2';
import { samplePaletteColor } from './palette-color-sampler.js?v=2.0.0-20260814.2';
import { configureTreeWindMaterial } from './tree-wind-shader.js?v=2.0.0-20260814.2';

const UP = new THREE.Vector3(0, 1, 0);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

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

function createFallbackMaterial(settings) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness:
      settings.roughness ?? LEAF_DETAIL_RENDERING_CONSTANTS.defaultRoughness,
    metalness: LEAF_DETAIL_RENDERING_CONSTANTS.materialMetalness,
    side: THREE.DoubleSide,
  });
  material.name = 'leaf-detail-material';
  return configureTreeWindMaterial(material, { cacheKey: 'leaf-detail-wind-v2' });
}

function hasStylizedResources(resources) {
  return Boolean(resources?.paletteTexture && resources?.sunDirection);
}

function resolveStylizedColorMix(treeData, settings, record) {
  return calculateHeroLeafColorMix(
    treeData.seed,
    record.sample.id,
    record.layer,
    record.sample.colorMix,
    settings.colorJitter,
    treeData.palette.variation,
  );
}

function resolveFallbackPaletteCoordinate(treeData, settings, record) {
  return calculateHeroLeafPaletteCoordinate(
    treeData.seed,
    record.sample.id,
    record.layer,
    record.sample.colorMix,
    settings.colorLift,
    settings.colorJitter,
  );
}

export class LeafClusterBuilder {
  constructor({
    geometryFactory = new LeafClusterGeometryFactory(),
    materialFactory = new HeroLeafMaterialFactory(),
  } = {}) {
    this.geometryFactory = geometryFactory;
    this.materialFactory = materialFactory;
  }

  build(treeData, resources = null) {
    const settings = treeData.palette.heroLeaves;
    if (!settings.enabled || settings.density <= 0 || treeData.shell.length === 0) {
      return createEmptyLeafShell(settings);
    }

    const selected = selectHeroLeafSamples(treeData, settings.density);
    if (selected.length === 0) return createEmptyLeafShell(settings);

    const surfaceRecords = createSurfaceRecords(selected, settings.layerCount);
    if (surfaceRecords.length === 0) return createEmptyLeafShell(settings);

    const field = new CrownVolumeField(treeData);
    const records = surfaceRecords;
    const stylized = hasStylizedResources(resources);
    let geometry = null;
    let material = null;

    try {
      geometry = this.geometryFactory.create(settings);
      if (stylized) {
        addFoliageInstanceAttributes(geometry, records, {
          getColorMix: (record) => resolveStylizedColorMix(treeData, settings, record),
          getExposure: (record) => record.sample.exposure,
          getCrownDirection: (record) => record.sample.normal,
        });
        material = this.materialFactory.create({
          foliage: treeData.palette,
          settings,
          paletteTexture: resources.paletteTexture,
          sunDirection: resources.sunDirection,
        });
      } else {
        material = createFallbackMaterial(settings);
      }

      const mesh = new THREE.InstancedMesh(geometry, material, records.length);
      const matrix = new THREE.Matrix4();
      const alignment = new THREE.Quaternion();
      const spin = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const instanceColor = stylized ? null : new THREE.Color();
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
        const stretch = calculateHeroClusterStretch(
          treeData.seed,
          record.sample.id,
          record.layer,
        );
        scale.set(
          instanceScale * stretch.x,
          instanceScale,
          instanceScale * stretch.z,
        );
        matrix.compose(position, alignment, scale);
        mesh.setMatrixAt(index, matrix);

        if (!stylized) {
          mesh.setColorAt(
            index,
            samplePaletteColor(
              treeData.palette.palette,
              resolveFallbackPaletteCoordinate(treeData, settings, record),
              instanceColor,
            ),
          );
        }
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
        stylized,
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
