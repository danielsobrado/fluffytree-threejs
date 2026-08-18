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

function surfaceIntensity(u, v, alpha, config) {
  const waveA = Math.sin((u * 4.1 + v * 1.7) * Math.PI * 2);
  const waveB = Math.sin((u * 1.3 - v * 3.7) * Math.PI * 2);
  const mottle = 0.5 + waveA * waveB * 0.5;
  const verticalShade = (0.5 - v) * config.surfaceVerticalTint;
  const edgeShade = (1 - alpha) ** 2 * config.surfaceEdgeDarkening;
  return Math.max(
    0.65,
    Math.min(1, 1 - mottle * config.surfaceMottle - verticalShade - edgeShade),
  );
}

export function createTreeIrFoliageAlphaTexture(
  primitiveFamily,
  resolution,
  requestedShapeId = null,
  {
    surfaceMottle = 0,
    surfaceEdgeDarkening = 0,
    surfaceVerticalTint = 0,
  } = {},
) {
  const shapeId = alphaShapeId(primitiveFamily, requestedShapeId);
  const shape = getLeafShape(shapeId);
  const data = new Uint8Array(resolution * resolution * 4);
  const surfaceConfig = {
    surfaceMottle,
    surfaceEdgeDarkening,
    surfaceVerticalTint,
  };

  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      const u = (x + 0.5) / resolution - 0.5;
      const v = (y + 0.5) / resolution - 0.5;
      const alphaUnit = sampleLeafAlpha(u, v, shape);
      const alpha = Math.round(alphaUnit * 255);
      const intensity = Math.round(
        surfaceIntensity(u, v, alphaUnit, surfaceConfig) * 255,
      );
      const offset = (y * resolution + x) * 4;
      data[offset] = intensity;
      data[offset + 1] = intensity;
      data[offset + 2] = intensity;
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
  texture.userData.foliageSurface = Object.freeze({
    surfaceMottle,
    surfaceEdgeDarkening,
    surfaceVerticalTint,
  });
  texture.needsUpdate = true;
  return texture;
}
