import * as THREE from 'three';
import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js';
import { configureStylizedFoliageShader } from './stylized-foliage-shader.js';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export class FoliageShellMaterialFactory {
  create({ foliage, paletteTexture, alphaTexture, sunDirection }) {
    const shellFoliage = Object.freeze({
      ...foliage,
      paletteBase: clamp01(foliage.paletteBase + foliage.shell.paletteLift),
      cavityStrength: foliage.cavityStrength * foliage.shell.cavityScale,
      crownNormalBlend: foliage.shell.normalBlend,
    });
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      alphaMap: alphaTexture,
      alphaTest: foliage.shell.alphaTest,
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide,
      roughness: FOLIAGE_RENDERING_CONSTANTS.shellRoughness,
      metalness: 0,
    });
    material.name = 'foliage-shell-fin-material';
    material.alphaToCoverage = true;

    configureStylizedFoliageShader(material, {
      foliage: shellFoliage,
      paletteTexture,
      sunDirection,
      radialNormalExpression: 'vec3( 0.0, 0.0, 1.0 )',
      heightExpression: 'uv.y',
      forceRadialFragmentNormal: true,
      cacheKey: 'foliage-shell-phase-2-5-v1',
    });
    material.userData.disposables.push(alphaTexture);
    return material;
  }
}
