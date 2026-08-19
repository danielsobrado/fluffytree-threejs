import * as THREE from 'three';
import { LEAF_DETAIL_RENDERING_CONSTANTS } from './leaf-detail-rendering-constants.js';
import { configureStylizedFoliageShader } from './stylized-foliage-shader.js';

export class HeroLeafMaterialFactory {
  create({ foliage, settings, paletteTexture, sunDirection }) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness:
        settings.roughness ?? LEAF_DETAIL_RENDERING_CONSTANTS.defaultRoughness,
      metalness: LEAF_DETAIL_RENDERING_CONSTANTS.materialMetalness,
      side: THREE.DoubleSide,
    });
    material.name = 'leaf-detail-material';

    return configureStylizedFoliageShader(material, {
      foliage,
      paletteTexture,
      sunDirection,
      radialNormalExpression: 'objectNormal',
      heightExpression: '0.5',
      surfaceBreakup: foliage.surfaceBreakup ?? 0.025,
      cacheKey: 'hero-leaf-stylized-v1',
    });
  }
}
