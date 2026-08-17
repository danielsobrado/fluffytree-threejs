import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TreeIrFrondGeometryFactory } from './tree-ir-frond-geometry-factory.js';

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
      material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: Number(treeIr.metadata.material.foliageRoughness ?? 0.86),
        metalness: 0,
        fog: true,
      });
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = name;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData.fronds = Object.freeze({
        count: sites.length,
        segmentRatio,
        leaflets,
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
