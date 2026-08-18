import * as THREE from 'three';
import { createTreeIrCrownGeometry } from './tree-ir-crown-geometry.js';
import { calculateTreeIrCrownStyle } from './tree-ir-crown-style.js';
import { setTreeIrPaletteColor } from './tree-ir-palette.js';
import { configureTreeWindMaterial } from './tree-wind-shader.js';

function createExposureResolver(volumes) {
  if (volumes.length < 2) return () => 1;

  let centerX = 0;
  let centerZ = 0;
  let minimumY = Number.POSITIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;
  for (const volume of volumes) {
    centerX += volume.center.x;
    centerZ += volume.center.z;
    minimumY = Math.min(minimumY, volume.center.y);
    maximumY = Math.max(maximumY, volume.center.y);
  }
  centerX /= volumes.length;
  centerZ /= volumes.length;

  let maximumRadius = 0;
  for (const volume of volumes) {
    maximumRadius = Math.max(
      maximumRadius,
      Math.hypot(volume.center.x - centerX, volume.center.z - centerZ),
    );
  }

  const heightSpan = Math.max(Number.EPSILON, maximumY - minimumY);
  const radiusSpan = Math.max(Number.EPSILON, maximumRadius);
  return (volume) => {
    const verticalExposure = (volume.center.y - minimumY) / heightSpan;
    const radialExposure =
      Math.hypot(volume.center.x - centerX, volume.center.z - centerZ) / radiusSpan;
    return Math.min(1, Math.max(verticalExposure, radialExposure));
  };
}

export class TreeIrCrownVolumeBuilder {
  build(
    treeIr,
    {
      detail = 1,
      scaleMultiplier = 1,
      brightness = 1,
      shapeVariation = 0,
      surfaceVariation = 0,
      depthShading = 0,
      castShadow = false,
      receiveShadow = true,
      name = 'tree-ir-crown-volumes',
    } = {},
  ) {
    let geometry = null;
    let material = null;
    try {
      const volumes = treeIr.crownVolumes;
      const resolveExposure = createExposureResolver(volumes);
      geometry = createTreeIrCrownGeometry(detail, surfaceVariation, depthShading);
      material = configureTreeWindMaterial(
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          vertexColors: true,
          roughness: Math.min(
            1,
            Number(treeIr.metadata.material.foliageRoughness ?? 0.9) + 0.08,
          ),
          metalness: 0,
          fog: true,
        }),
        { cacheKey: 'tree-ir-crown-core-wind-v2' },
      );
      const mesh = new THREE.InstancedMesh(geometry, material, volumes.length);
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const euler = new THREE.Euler();
      const scale = new THREE.Vector3();
      const color = new THREE.Color();
      const palette = treeIr.metadata.material.foliagePalette;
      const styleConfig = { brightness, shapeVariation, depthShading };

      volumes.forEach((volume, index) => {
        const style = calculateTreeIrCrownStyle(
          treeIr,
          volume,
          styleConfig,
          resolveExposure(volume),
        );
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
        surfaceVariation,
        depthShading,
        localDepthColors: true,
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
