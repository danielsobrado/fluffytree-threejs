import * as THREE from 'three';
import { calculateTreeBarkColorMix } from './tree-bark-color-profile.js';
import { TREE_BARK_PATTERNS } from './tree-bark-style-constants.js';

const TAU = Math.PI * 2;
const MINIMUM_TREE_HEIGHT = 0.001;

export function addStylizedBarkColors(
  geometry,
  palette,
  seed,
  order = 0,
  treeHeight = 1,
  { pattern = TREE_BARK_PATTERNS.WOOD } = {},
) {
  const colors = palette.map((value) => new THREE.Color(value));
  const positions = geometry.getAttribute('position');
  const uvs = geometry.getAttribute('uv');
  const output = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  const phase = (((Number(seed) >>> 0) % 4093) / 4093) * TAU + order * 0.73;
  const inverseTreeHeight = 1 / Math.max(MINIMUM_TREE_HEIGHT, treeHeight);
  const colorProfile = {
    u: 0,
    v: 0,
    phase,
    order,
    treeHeight,
    pattern,
  };

  for (let index = 0; index < positions.count; index += 1) {
    colorProfile.u = uvs?.getX(index) ?? 0;
    colorProfile.v = Math.min(
      1,
      Math.max(0, positions.getY(index) * inverseTreeHeight),
    );
    const baseMix = calculateTreeBarkColorMix(colorProfile);

    if (baseMix < 0.52) {
      color.lerpColors(colors[0], colors[1], baseMix / 0.52);
    } else {
      color.lerpColors(colors[1], colors[2], (baseMix - 0.52) / 0.48);
    }
    const offset = index * 3;
    output[offset] = color.r;
    output[offset + 1] = color.g;
    output[offset + 2] = color.b;
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
          float treeWoodPrimaryPhase =
            uTreeWindPhase + position.y * 0.31;
          float treeWoodSecondaryPhase =
            uTreeWindPhase * 1.7 + position.y * 0.23;
          float treeWoodGust =
            sin(uTreeWindTime * 0.78 + treeWoodPrimaryPhase) -
            sin(treeWoodPrimaryPhase);
          float treeWoodCross =
            sin(uTreeWindTime * 1.17 + treeWoodSecondaryPhase) -
            sin(treeWoodSecondaryPhase);
          transformed.x +=
            treeWoodGust * uTreeWindStrength * treeWoodFlex * 0.38;
          transformed.z +=
            treeWoodCross * uTreeWindStrength * treeWoodFlex * 0.16;
        `,
      );
      material.userData.shader = shader;
    };
    material.customProgramCacheKey = () => 'stylized-bark-wind-v2';
    return material;
  }
}
