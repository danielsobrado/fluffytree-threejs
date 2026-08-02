import * as THREE from 'three';
import {
  FOLIAGE_ALPHA_SHAPES,
  FOLIAGE_RENDERING_CONSTANTS,
} from './foliage-rendering-constants.js';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0, edge1, value) {
  const normalized = clamp01((value - edge0) / (edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
}

function sampleShape(x, y, shape) {
  const cos = Math.cos(shape.angle);
  const sin = Math.sin(shape.angle);
  const offsetX = x - shape.x;
  const offsetY = y - shape.y;
  const localX = offsetX * cos + offsetY * sin;
  const localY = -offsetX * sin + offsetY * cos;
  const longitudinal = localY / shape.radiusY;
  const leafEnvelope = Math.max(0.08, 1 - Math.abs(longitudinal) ** 1.65);
  const lateral = localX / (shape.radiusX * Math.sqrt(leafEnvelope));
  const distance = lateral ** 2 + longitudinal ** 2;

  return 1 - smoothstep(0.72, 1.03, distance);
}

function sampleAlpha(x, y) {
  let alpha = 0;

  for (const shape of FOLIAGE_ALPHA_SHAPES) {
    alpha = Math.max(alpha, sampleShape(x, y, shape));
  }

  const spine =
    (1 - smoothstep(0.04, 0.15, Math.abs(x))) *
    (1 - smoothstep(0.45, 0.51, Math.abs(y)));
  return clamp01(Math.max(alpha, spine * 0.92));
}

export class FoliageAlphaTextureFactory {
  create() {
    const resolution = FOLIAGE_RENDERING_CONSTANTS.alphaTextureResolution;
    const data = new Uint8Array(resolution * resolution * 4);

    for (let y = 0; y < resolution; y += 1) {
      for (let x = 0; x < resolution; x += 1) {
        const normalizedX = (x + 0.5) / resolution - 0.5;
        const normalizedY = (y + 0.5) / resolution - 0.5;
        const alpha = Math.round(sampleAlpha(normalizedX, normalizedY) * 255);
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
    texture.name = 'foliage-fin-alpha';
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
