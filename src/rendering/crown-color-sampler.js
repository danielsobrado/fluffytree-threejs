import * as THREE from 'three';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function createPatchPhase(seed) {
  const value = Number(seed) >>> 0;
  return {
    x: ((value * 0.0713) % 1) * Math.PI * 2,
    y: ((value * 0.0931 + 0.31) % 1) * Math.PI * 2,
    z: ((value * 0.1177 + 0.67) % 1) * Math.PI * 2,
  };
}

function samplePatch(position, settings, phase) {
  const scale = settings.colorPatchScale;
  const first =
    Math.sin(position.x * scale + phase.x) *
    Math.cos(position.z * scale * 0.83 + phase.z);
  const second = Math.sin(
    position.y * scale * 0.71 +
      position.z * scale * 0.27 +
      phase.y,
  );
  return first * 0.65 + second * 0.35;
}

function samplePalette(palette, coordinate, target) {
  const scaled = clamp01(coordinate) * (palette.length - 1);
  const lowerIndex = Math.min(palette.length - 2, Math.floor(scaled));
  const ratio = scaled - lowerIndex;
  return target.copy(palette[lowerIndex]).lerp(palette[lowerIndex + 1], ratio);
}

export function createCrownVertexColors(treeData, volume) {
  const palette = treeData.palette.palette.map((value) => new THREE.Color(value));
  const settings = treeData.palette.volume;
  const phase = createPatchPhase(treeData.seed);
  const colors = new Float32Array(volume.vertexCount * 3);
  const position = new THREE.Vector3();
  const color = new THREE.Color();
  const crownHeight = Math.max(
    Number.EPSILON,
    volume.bounds.maximum.y - volume.bounds.minimum.y,
  );

  for (let index = 0; index < volume.vertexCount; index += 1) {
    position.fromArray(volume.positions, index * 3);
    const height = clamp01(
      (position.y - volume.bounds.minimum.y) / crownHeight,
    );
    const patch = samplePatch(position, settings, phase);
    const coordinate =
      treeData.palette.paletteBase +
      (height - 0.5) * treeData.palette.heightPaletteShift +
      patch * settings.colorPatchStrength;

    samplePalette(palette, coordinate, color);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  return colors;
}
