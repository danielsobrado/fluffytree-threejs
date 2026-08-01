import * as THREE from 'three';
import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js';
import { configureStylizedFoliageShader } from './stylized-foliage-shader.js';

export class FoliageCoreMaterialFactory {
  create({ foliage, paletteTexture, sunDirection }) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: FOLIAGE_RENDERING_CONSTANTS.coreRoughness,
      metalness: 0,
    });
    material.name = 'foliage-core-material';

    return configureStylizedFoliageShader(material, {
      foliage,
      paletteTexture,
      sunDirection,
      radialNormalExpression: 'normalize( position )',
      heightExpression: 'position.y * 0.5 + 0.5',
      cacheKey: 'foliage-core-phase-2-v1',
    });
  }
}
