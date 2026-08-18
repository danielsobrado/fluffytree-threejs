import * as THREE from 'three';
import { DEFAULT_LEAF_SHAPE_ID } from './leaf-shape-library.js';
import { createTreeIrFoliageAlphaTexture } from './tree-ir-foliage-alpha-texture.js';
import { createTreeIrFoliageCardGeometry } from './tree-ir-foliage-card-geometry.js';
import { calculateTreeIrFoliageCardStyle } from './tree-ir-foliage-card-style.js';
import { configureTreeIrFoliageLighting } from './tree-ir-foliage-lighting.js';
import { setTreeIrPaletteColor } from './tree-ir-palette.js';
import { configureTreeWindMaterial } from './tree-wind-shader.js';

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
      depthSpread = 0,
      normalBlend = 0,
      normalUpBias = 0,
      alphaResolution,
      alphaTest,
      scaleMultiplier = 1,
      cardScaleVariation = 0,
      cardStretch = 0,
      cardTwist = 0,
      cardLean = 0,
      canopyHeightTint = 0,
      canopyRadialTint = 0,
      surfaceMottle = 0,
      surfaceEdgeDarkening = 0,
      surfaceVerticalTint = 0,
      softLight = 0,
      rimLight = 0,
      backLight = 0,
      name = 'tree-ir-foliage-cards',
    },
  ) {
    let geometry = null;
    let texture = null;
    let material = null;
    try {
      const leafShape = treeIr.metadata.material.leafShape ?? DEFAULT_LEAF_SHAPE_ID;
      geometry = createTreeIrFoliageCardGeometry({
        planeCount,
        depthSpread,
        normalBlend,
        normalUpBias,
      });
      texture = createTreeIrFoliageAlphaTexture(
        primitiveFamily,
        alphaResolution,
        leafShape,
        { surfaceMottle, surfaceEdgeDarkening, surfaceVerticalTint },
      );
      material = configureTreeIrFoliageLighting(
        configureTreeWindMaterial(
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: texture,
            alphaTest,
            alphaToCoverage: true,
            transparent: false,
            side: THREE.DoubleSide,
            roughness: Number(treeIr.metadata.material.foliageRoughness ?? 0.9),
            metalness: 0,
            fog: true,
          }),
          { cacheKey: 'tree-ir-foliage-card-wind-v3' },
        ),
        { softLight, rimLight, backLight },
      );
      material.userData.disposables = [texture];
      const mesh = new THREE.InstancedMesh(geometry, material, sites.length);
      const basisMatrix = new THREE.Matrix4();
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const localRotation = new THREE.Quaternion();
      const localEuler = new THREE.Euler();
      const scale = new THREE.Vector3();
      const xAxis = new THREE.Vector3();
      const yAxis = new THREE.Vector3();
      const zAxis = new THREE.Vector3();
      const color = new THREE.Color();
      const palette = treeIr.metadata.material.foliagePalette;
      const styleConfig = {
        cardScaleVariation,
        cardStretch,
        cardTwist,
        cardLean,
        canopyHeightTint,
        canopyRadialTint,
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
        localEuler.set(style.leanX, style.twist, style.leanZ, 'YXZ');
        localRotation.setFromEuler(localEuler);
        quaternion.multiply(localRotation);
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
          setTreeIrPaletteColor(color, palette, style.colorMix).multiplyScalar(
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
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      mesh.userData.foliageCards = Object.freeze({
        primitiveFamily,
        leafShape,
        instanceCount: sites.length,
        planeCount,
        depthSpread,
        normalBlend,
        normalUpBias,
        scaleMultiplier,
        alphaTest,
        alphaToCoverage: material.alphaToCoverage,
        cardLean,
        canopyHeightTint,
        canopyRadialTint,
        surfaceMottle,
        surfaceEdgeDarkening,
        surfaceVerticalTint,
        softLight,
        rimLight,
        backLight,
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
