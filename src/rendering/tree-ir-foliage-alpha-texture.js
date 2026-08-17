import * as THREE from 'three';
import {
  DEFAULT_LEAF_SHAPE_ID,
  getLeafShape,
  sampleLeafAlpha,
} from './leaf-shape-library.js';

function alphaShapeId(primitiveFamily, requestedShapeId) {
  if (primitiveFamily === 'needle-cluster') return 'needle';
  return requestedShapeId ?? DEFAULT_LEAF_SHAPE_ID;
}

export function createTreeIrFoliageAlphaTexture(
  primitiveFamily,
  resolution,
  requestedShapeId = null,
) {
  const shapeId = alphaShapeId(primitiveFamily, requestedShapeId);
  const shape = getLeafShape(shapeId);
  const data = new Uint8Array(resolution * resolution * 4);

  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      const u = (x + 0.5) / resolution - 0.5;
      const v = (y + 0.5) / resolution - 0.5;
      const alpha = Math.round(sampleLeafAlpha(u, v, shape) * 255);
      const offset = (y * resolution + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = alpha;
    }
  }

  const texture = new THREE.DataTexture(
    data,
    resolution,
    resolution,
    THREE.RGBAFormat,
  );
  texture.name = `tree-ir-${primitiveFamily}-${shapeId}-alpha`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
