import * as THREE from 'three';
import { setTreeIrPaletteColor } from './tree-ir-palette.js';

export class TreeIrCrownVolumeBuilder {
  build(
    treeIr,
    {
      detail = 1,
      scaleMultiplier = 1,
      castShadow = false,
      receiveShadow = true,
      name = 'tree-ir-crown-volumes',
    } = {},
  ) {
    let geometry = null;
    let material = null;
    try {
      const volumes = treeIr.crownVolumes;
      geometry = new THREE.IcosahedronGeometry(1, detail);
      material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: Number(treeIr.metadata.material.foliageRoughness ?? 0.9),
        metalness: 0,
        fog: true,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, volumes.length);
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const euler = new THREE.Euler();
      const scale = new THREE.Vector3();
      const color = new THREE.Color();
      const palette = treeIr.metadata.material.foliagePalette;

      volumes.forEach((volume, index) => {
        position.set(volume.center.x, volume.center.y, volume.center.z);
        euler.set(volume.rotation.x, volume.rotation.y, volume.rotation.z);
        quaternion.setFromEuler(euler);
        scale.set(
          volume.scale.x * scaleMultiplier,
          volume.scale.y * scaleMultiplier,
          volume.scale.z * scaleMultiplier,
        );
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(index, matrix);
        mesh.setColorAt(
          index,
          setTreeIrPaletteColor(color, palette, volume.colorMix),
        );
      });

      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.setUsage(THREE.StaticDrawUsage);
        mesh.instanceColor.needsUpdate = true;
      }
      mesh.name = name;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      mesh.userData.crownVolumes = Object.freeze({
        count: volumes.length,
        detail,
        scaleMultiplier,
      });
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
