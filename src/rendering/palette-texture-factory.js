import * as THREE from 'three';
import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js?v=2.0.0-20260814.2';

function clampByte(value) {
  return Math.min(255, Math.max(0, Math.round(value * 255)));
}

function samplePalette(colors, normalizedPosition, result) {
  const segmentCount = colors.length - 1;
  const scaledPosition = normalizedPosition * segmentCount;
  const leftIndex = Math.min(
    segmentCount - 1,
    Math.max(0, Math.floor(scaledPosition)),
  );
  const blend = Math.min(1, Math.max(0, scaledPosition - leftIndex));

  return result.copy(colors[leftIndex]).lerp(colors[leftIndex + 1], blend);
}

export class PaletteTextureFactory {
  create(colorValues) {
    const colors = colorValues.map((value) => new THREE.Color(value));
    const resolution = FOLIAGE_RENDERING_CONSTANTS.paletteTextureResolution;
    const data = new Uint8Array(resolution * 4);
    const sampled = new THREE.Color();

    for (let index = 0; index < resolution; index += 1) {
      const position = index / (resolution - 1);
      samplePalette(colors, position, sampled);
      const offset = index * 4;
      data[offset] = clampByte(sampled.r);
      data[offset + 1] = clampByte(sampled.g);
      data[offset + 2] = clampByte(sampled.b);
      data[offset + 3] = 255;
    }

    const texture = new THREE.DataTexture(
      data,
      resolution,
      1,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    texture.name = 'foliage-palette';
    texture.colorSpace = THREE.NoColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }
}
