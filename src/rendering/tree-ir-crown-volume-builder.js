import * as THREE from 'three';
import { calculateTreeIrCrownStyle } from './tree-ir-crown-style.js';
import { setTreeIrPaletteColor } from './tree-ir-palette.js';

export class TreeIrCrownVolumeBuilder {
  build(
    treeIr,
    {
      detail = 1,
      scaleMultiplier = 1,
      brightness = 1,
      shapeVariation = 0,
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
        roughness: Math.min(
          1,
          Number(treeIr.metadata.material.foliageRoughness ?? 0.9) + 0.08,
        ),
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
      const styleConfig = { brightness, shapeVariation };

      volumes.forEach((volume, index) => {
        const style = calculateTreeIrCrownStyle(treeIr, volume, styleConfig);
        position.set(volume.center.x, volume.center.y, volume.center.z);
        euler.set(volume.rotation.x, volume.rotation.y, volume.rotation.z);
        quaternion.setFromEuler(euler);
        scale.set(
          Math.max(0.01, volume.scale.x * scaleMultiplier * style.scaleX),
          Math.max(0.01, volume.scale.y * scaleMultiplier * style.scaleY),
          Math.max(0.01, volume.scale.z * scaleMultiplier * style.scaleZ),
        );
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(index, matrix);
        mesh.setColorAt(
          index,
          setTreeIrPaletteColor(color, palette, volume.colorMix).multiplyScalar(
            style.brightness,
          ),
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
        brightness,
        shapeVariation,
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
