import * as THREE from 'three';

const TAU = Math.PI * 2;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function addStylizedBarkColors(
  geometry,
  palette,
  seed,
  order = 0,
  treeHeight = 1,
) {
  const colors = palette.map((value) => new THREE.Color(value));
  const positions = geometry.getAttribute('position');
  const output = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  const phase = (((Number(seed) >>> 0) % 4093) / 4093) * TAU + order * 0.73;

  for (let index = 0; index < positions.count; index += 1) {
    const u = geometry.getAttribute('uv')?.getX(index) ?? 0;
    const v = clamp01(positions.getY(index) / Math.max(0.001, treeHeight));
    const grain = Math.sin(v * 31 + Math.sin(u * TAU * 3 + phase) * 1.8 + phase);
    const broad = Math.sin(v * 7.5 + u * TAU + phase * 0.6);
    const ridge = clamp01(0.5 + grain * 0.16 + broad * 0.12 + order * 0.035);
    const baseMix = clamp01(ridge - Math.pow(1 - clamp01(v), 3) * 0.22);

    if (baseMix < 0.52) {
      color.lerpColors(colors[0], colors[1], baseMix / 0.52);
    } else {
      color.lerpColors(colors[1], colors[2], (baseMix - 0.52) / 0.48);
    }
    output[index * 3] = color.r;
    output[index * 3 + 1] = color.g;
    output[index * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(output, 3));
  return geometry;
}

export class StylizedBarkMaterialFactory {
  create({ height = 1 } = {}) {
    const windState = { time: 0, phase: 0, strength: 0.055 };
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.98,
      metalness: 0,
    });
    material.name = 'stylized-bark-material';
    material.userData.windState = windState;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTreeWindTime = {
        get value() {
          return windState.time;
        },
      };
      shader.uniforms.uTreeWindPhase = {
        get value() {
          return windState.phase;
        },
      };
      shader.uniforms.uTreeWindStrength = {
        get value() {
          return windState.strength;
        },
      };
      shader.uniforms.uTreeHeight = { value: Math.max(0.001, height) };
      shader.vertexShader = `
        uniform float uTreeWindTime;
        uniform float uTreeWindPhase;
        uniform float uTreeWindStrength;
        uniform float uTreeHeight;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
        `
          #include <begin_vertex>
          float treeWoodHeight = clamp(position.y / uTreeHeight, 0.0, 1.0);
          float treeWoodFlex = smoothstep(0.48, 1.0, treeWoodHeight);
          float treeWoodGust = sin(
            uTreeWindTime * 0.78 + uTreeWindPhase + position.y * 0.31
          );
          transformed.x += treeWoodGust * uTreeWindStrength * treeWoodFlex * 0.38;
          transformed.z += sin(
            uTreeWindTime * 1.17 + uTreeWindPhase * 1.7 + position.y * 0.23
          ) * uTreeWindStrength * treeWoodFlex * 0.16;
        `,
      );
      material.userData.shader = shader;
    };
    material.customProgramCacheKey = () => 'stylized-bark-wind-v1';
    return material;
  }
}
