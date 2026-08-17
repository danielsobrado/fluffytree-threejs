import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTreeIrFoliageAlphaTexture } from './tree-ir-foliage-alpha-texture.js';
import { calculateTreeIrFoliageCardStyle } from './tree-ir-foliage-card-style.js';
import { setTreeIrPaletteColor } from './tree-ir-palette.js';

function createCardGeometry(planeCount) {
  const geometries = [];
  try {
    for (let index = 0; index < planeCount; index += 1) {
      const geometry = new THREE.PlaneGeometry(1, 1);
      geometry.rotateY((index * Math.PI) / planeCount);
      geometries.push(geometry);
    }
    const merged = mergeGeometries(geometries, false);
    if (!merged) throw new Error('Failed to build direct IR foliage card geometry.');
    return merged;
  } finally {
    for (const geometry of geometries) geometry.dispose();
  }
}

function siteScale(site) {
  return Number(
    site.metadata?.broadleaf?.foliageScale ??
      site.metadata?.needle?.foliageScale ??
      1,
  );
}

export class TreeIrFoliageCardBuilder {
  build(
    treeIr,
    sites,
    {
      primitiveFamily,
      planeCount,
      alphaResolution,
      alphaTest,
      scaleMultiplier = 1,
      cardScaleVariation = 0,
      cardStretch = 0,
      cardTwist = 0,
      name = 'tree-ir-foliage-cards',
    },
  ) {
    let geometry = null;
    let texture = null;
    let material = null;
    try {
      geometry = createCardGeometry(planeCount);
      texture = createTreeIrFoliageAlphaTexture(
        primitiveFamily,
        alphaResolution,
      );
      material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texture,
        alphaTest,
        transparent: false,
        side: THREE.DoubleSide,
        roughness: Number(treeIr.metadata.material.foliageRoughness ?? 0.9),
        metalness: 0,
        fog: true,
      });
      material.userData.disposables = [texture];
      const mesh = new THREE.InstancedMesh(geometry, material, sites.length);
      const basisMatrix = new THREE.Matrix4();
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const localTwist = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const xAxis = new THREE.Vector3();
      const yAxis = new THREE.Vector3();
      const zAxis = new THREE.Vector3();
      const localYAxis = new THREE.Vector3(0, 1, 0);
      const color = new THREE.Color();
      const palette = treeIr.metadata.material.foliagePalette;
      const styleConfig = {
        cardScaleVariation,
        cardStretch,
        cardTwist,
      };

      sites.forEach((site, index) => {
        position.set(site.frame.position.x, site.frame.position.y, site.frame.position.z);
        xAxis.set(site.frame.normal.x, site.frame.normal.y, site.frame.normal.z);
        yAxis.set(site.frame.tangent.x, site.frame.tangent.y, site.frame.tangent.z);
        zAxis.set(site.frame.binormal.x, site.frame.binormal.y, site.frame.binormal.z);
        basisMatrix.makeBasis(xAxis, yAxis, zAxis);
        quaternion.setFromRotationMatrix(basisMatrix);
        const style = calculateTreeIrFoliageCardStyle(
          treeIr,
          site,
          styleConfig,
        );
        localTwist.setFromAxisAngle(localYAxis, style.twist);
        quaternion.multiply(localTwist);
        const size = Math.max(0.01, siteScale(site) * scaleMultiplier);
        scale.set(
          size * style.widthScale,
          size * style.heightScale,
          size * style.widthScale,
        );
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(index, matrix);
        mesh.setColorAt(
          index,
          setTreeIrPaletteColor(
            color,
            palette,
            style.brightness * 0.5 + 0.25,
          ).multiplyScalar(style.brightness),
        );
      });

      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.setUsage(THREE.StaticDrawUsage);
        mesh.instanceColor.needsUpdate = true;
      }
      mesh.name = name;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      mesh.userData.foliageCards = Object.freeze({
        primitiveFamily,
        instanceCount: sites.length,
        planeCount,
        scaleMultiplier,
        alphaTest,
      });
      geometry = null;
      texture = null;
      material = null;
      return mesh;
    } catch (error) {
      geometry?.dispose();
      texture?.dispose();
      material?.dispose();
      throw error;
    }
  }
}
