import * as THREE from 'three';
import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js';
import {
  DEFAULT_LEAF_SHAPE_ID,
  getLeafShape,
  sampleLeafAlpha,
} from './leaf-shape-library.js';

export class FoliageAlphaTextureFactory {
  create(shapeId = DEFAULT_LEAF_SHAPE_ID) {
    const leafShape = getLeafShape(shapeId);
    const resolution = FOLIAGE_RENDERING_CONSTANTS.alphaTextureResolution;
    const data = new Uint8Array(resolution * resolution * 4);

    for (let y = 0; y < resolution; y += 1) {
      for (let x = 0; x < resolution; x += 1) {
        const normalizedX = (x + 0.5) / resolution - 0.5;
        const normalizedY = (y + 0.5) / resolution - 0.5;
        const alpha = Math.round(
          sampleLeafAlpha(normalizedX, normalizedY, leafShape) * 255,
        );
        const offset = (y * resolution + x) * 4;
        data[offset] = alpha;
        data[offset + 1] = alpha;
        data[offset + 2] = alpha;
        data[offset + 3] = 255;
      }
    }

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
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }
}
