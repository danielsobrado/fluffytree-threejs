import * as THREE from 'three';
import { LEAF_DETAIL_RENDERING_CONSTANTS } from './leaf-detail-rendering-constants.js';
import { configureStylizedFoliageShader } from './stylized-foliage-shader.js';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export class HeroLeafMaterialFactory {
  create({ foliage, settings, paletteTexture, sunDirection }) {
    const heroFoliage = Object.freeze({
      ...foliage,
      paletteBase: clamp01(
        foliage.paletteBase + Number(settings.colorLift ?? 0),
      ),
    });
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness:
        settings.roughness ?? LEAF_DETAIL_RENDERING_CONSTANTS.defaultRoughness,
      metalness: LEAF_DETAIL_RENDERING_CONSTANTS.materialMetalness,
      side: THREE.DoubleSide,
    });
    material.name = 'leaf-detail-material';

    return configureStylizedFoliageShader(material, {
      foliage: heroFoliage,
      paletteTexture,
      sunDirection,
      radialNormalExpression: 'objectNormal',
      heightExpression: '0.5',
      surfaceBreakup: foliage.surfaceBreakup ?? 0.025,
      cacheKey: 'hero-leaf-stylized-v2',
    });
  }
}
