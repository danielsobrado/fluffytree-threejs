import * as THREE from 'three';
import { CrownVolumeField } from '../generation/crown-volume-field.js';
import {
  calculateHeroClusterStretch,
  calculateHeroClusterTilt,
  calculateHeroLeafColorMix,
  calculateHeroLeafPaletteCoordinate,
  selectHeroLeafSamples,
} from './hero-leaf-style.js';
import { HeroLeafMaterialFactory } from './hero-leaf-material-factory.js';
import { addFoliageInstanceAttributes } from './instanced-foliage-attributes.js';
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
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function resolveSettings(settings, options) {
  const layerCount = options.layerCount ?? settings.layerCount;
  if (!Number.isInteger(layerCount) || layerCount < 1 || layerCount > 4) {
    throw new RangeError('Leaf cluster layerCount must be an integer within [1, 4].');
  }
  return Object.freeze({ ...settings, layerCount });
}

function resolveDensity(settings, options) {
  const multiplier = Number(options.densityMultiplier ?? 1);
  if (!Number.isFinite(multiplier) || multiplier < 0) {
    throw new RangeError('Leaf cluster densityMultiplier must be a finite non-negative number.');
  }
  return clamp01(settings.density * multiplier);
}

function createEmptyLeafShell(settings, options = {}, density = settings.density) {
  const empty = new THREE.Group();
  empty.name = options.name ?? 'hero-leaf-shell';
  empty.userData.heroLeaves = {
    clusterCount: 0,
    surfaceClusterCount: 0,
    sourceSampleCount: 0,
    layerCount: settings.layerCount,
    leafCount: 0,
    density,
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

  build(treeData, resources = null, options = {}) {
    const settings = resolveSettings(treeData.palette.heroLeaves, options);
    const density = resolveDensity(settings, options);
    if (!settings.enabled || density <= 0 || treeData.shell.length === 0) {
      return createEmptyLeafShell(settings, options, density);
    }

    const selected = selectHeroLeafSamples(treeData, density);
    if (selected.length === 0) return createEmptyLeafShell(settings, options, density);

    const surfaceRecords = createSurfaceRecords(selected, settings.layerCount);
    if (surfaceRecords.length === 0) {
      return createEmptyLeafShell(settings, options, density);
    }

    const field = new CrownVolumeField(treeData);
    const records = surfaceRecords;
    const stylized = hasStylizedResources(resources);
    let geometry = null;
    let material = null;

    try {
      geometry = this.geometryFactory.create(settings, options.geometry ?? null);
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
      const tiltX = new THREE.Quaternion();
      const tiltZ = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const instanceColor = stylized ? null : new THREE.Color();
      const placement = {
        position: new THREE.Vector3(),
        normal: new THREE.Vector3(),
      };
      const position = new THREE.Vector3();
      const tangent = new THREE.Vector3();
      const bitangent = new THREE.Vector3();
      const maximumTilt = Number(options.orientation?.tiltRadians ?? 0);

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
        const tilt = calculateHeroClusterTilt(
          treeData.seed,
          record.sample.id,
          record.layer,
          maximumTilt,
        );
        if (tilt.x !== 0) {
          tiltX.setFromAxisAngle(X_AXIS, tilt.x);
          alignment.multiply(tiltX);
        }
        if (tilt.z !== 0) {
          tiltZ.setFromAxisAngle(Z_AXIS, tilt.z);
          alignment.multiply(tiltZ);
        }

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
      mesh.name = options.name ?? 'hero-leaf-shell';
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
        density,
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
