import * as THREE from 'three';
import { createFoliageAlphaPixels } from './foliage-alpha-profile.js?v=2.0.0-20260814.2';
import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js?v=2.0.0-20260814.2';
import { DEFAULT_LEAF_SHAPE_ID } from './leaf-shape-library.js?v=2.0.0-20260814.2';

export class FoliageAlphaTextureFactory {
  create(shapeId = DEFAULT_LEAF_SHAPE_ID) {
    const resolution = FOLIAGE_RENDERING_CONSTANTS.alphaTextureResolution;
    const data = createFoliageAlphaPixels(shapeId, resolution);
    const texture = new THREE.DataTexture(
      data,
      resolution,
      resolution,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    texture.name = `foliage-fin-alpha-${shapeId}`;
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }
}
