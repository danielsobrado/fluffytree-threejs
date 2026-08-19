import * as THREE from 'three';
import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js';
import { configureStylizedFoliageShader } from './stylized-foliage-shader.js';

export class FoliageCoreMaterialFactory {
  create({ foliage, paletteTexture, sunDirection }) {
    const coreFoliage = Object.freeze({
      ...foliage,
      paletteBase: Math.max(
        0,
        foliage.paletteBase - (1 - foliage.core.brightness) * 0.12,
      ),
      cavityStrength: Math.min(1, foliage.cavityStrength + 0.06),
      heightLightStrength: foliage.heightLightStrength * 0.72,
      rimStrength:
        Number(foliage.rimStrength ?? 0) * FOLIAGE_RENDERING_CONSTANTS.coreRimScale,
      translucencyStrength:
        Number(foliage.translucencyStrength ?? 0) *
        FOLIAGE_RENDERING_CONSTANTS.coreTranslucencyScale,
    });
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: FOLIAGE_RENDERING_CONSTANTS.coreRoughness,
      metalness: 0,
    });
    material.name = 'foliage-core-material';

    return configureStylizedFoliageShader(material, {
      foliage: coreFoliage,
      paletteTexture,
      sunDirection,
      radialNormalExpression: 'normalize( position )',
      heightExpression: 'position.y * 0.5 + 0.5',
      forceRadialFragmentNormal: true,
      colorMultiplier: foliage.core.brightness,
      surfaceBreakup: foliage.surfaceBreakup ?? 0.1,
      cacheKey: 'foliage-core-interior-mass-v7',
    });
  }
}
