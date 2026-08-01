import * as THREE from 'three';
import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js';
import { configureStylizedFoliageShader } from './stylized-foliage-shader.js';

export class FoliageShellMaterialFactory {
  create({ foliage, paletteTexture, alphaTexture, sunDirection }) {
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
    material.name = 'foliage-shell-material';
    material.alphaToCoverage = true;

    configureStylizedFoliageShader(material, {
      foliage,
      paletteTexture,
      sunDirection,
      radialNormalExpression: 'vec3( 0.0, 0.0, 1.0 )',
      heightExpression: 'position.y + 0.5',
      forceRadialFragmentNormal: true,
      cacheKey: 'foliage-shell-phase-2-v2',
    });
    material.userData.disposables.push(alphaTexture);
    return material;
  }
}
