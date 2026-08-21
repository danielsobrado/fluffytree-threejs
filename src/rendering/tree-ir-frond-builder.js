import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { configureTreeIrFoliageLighting } from './tree-ir-foliage-lighting.js?v=2.0.0-20260814.2';
import { TreeIrFrondGeometryFactory } from './tree-ir-frond-geometry-factory.js?v=2.0.0-20260814.2';
import { configureTreeIrFrondWindMaterial } from './tree-ir-frond-wind-material.js?v=2.0.0-20260814.2';

export class TreeIrFrondBuilder {
  constructor({ geometryFactory = new TreeIrFrondGeometryFactory() } = {}) {
    this.geometryFactory = geometryFactory;
  }

  build(
    treeIr,
    sites,
    {
      segmentRatio = 1,
      leaflets = false,
      rachisWidthRatio = 0.08,
      leafletLengthRatio = 0.96,
      leafletWidthRatio = 0.72,
      softLight = 0,
      rimLight = 0,
      backLight = 0,
      name = 'tree-ir-fronds',
    } = {},
  ) {
    const geometries = sites.map((site) =>
      this.geometryFactory.create(treeIr, site, {
        segmentRatio,
        leaflets,
        rachisWidthRatio,
        leafletLengthRatio,
        leafletWidthRatio,
      }),
    );
    let merged = null;
    let material = null;
    try {
      merged = mergeGeometries(geometries, false);
      if (!merged) throw new Error('Failed to merge Tree IR frond geometry.');
      material = configureTreeIrFoliageLighting(
        configureTreeIrFrondWindMaterial(
          new THREE.MeshStandardMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            roughness: Number(treeIr.metadata.material.foliageRoughness ?? 0.86),
            metalness: 0,
            fog: true,
          }),
        ),
        { softLight, rimLight, backLight },
      );
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = name;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData.fronds = Object.freeze({
        count: sites.length,
        segmentRatio,
        leaflets,
        softLight,
        rimLight,
        backLight,
      });
      merged = null;
      material = null;
      return mesh;
    } catch (error) {
      merged?.dispose();
      material?.dispose();
      throw error;
    } finally {
      for (const geometry of geometries) geometry.dispose();
    }
  }
}
