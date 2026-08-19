import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FoliageCoreMaterialFactory } from '../src/rendering/foliage-core-material-factory.js';
import { FoliageShellMaterialFactory } from '../src/rendering/foliage-shell-material-factory.js';

const FOLIAGE = Object.freeze({
  variation: 0.1,
  paletteBase: 0.5,
  heightPaletteShift: 0.2,
  exposurePaletteShift: 0.1,
  radialNormalStrength: 0.8,
  crownNormalBlend: 0.5,
  wrapLight: 0.5,
  skyLightStrength: 0.2,
  cavityStrength: 0.3,
  heightLightStrength: 0.1,
  undersideTint: '#a0b8aa',
  undersideStrength: 0.32,
  rimStrength: 0.3,
  rimPower: 2.5,
  translucencyStrength: 0.2,
  surfaceBreakup: 0.02,
  shell: Object.freeze({
    alphaTest: 0.36,
    paletteLift: 0.03,
    cavityScale: 0.82,
    normalBlend: 0.62,
  }),
  core: Object.freeze({ brightness: 0.82 }),
});

function createShader() {
  return {
    uniforms: {},
    vertexShader: `
      void main() {
        #include <beginnormal_vertex>
        #include <begin_vertex>
        #include <project_vertex>
      }
    `,
    fragmentShader: `
      void main() {
        #include <normal_fragment_begin>
        #include <color_fragment>
      }
    `,
  };
}

function compileSurfaceBreakup(material) {
  const shader = createShader();
  material.onBeforeCompile(shader);
  return shader.uniforms.uFoliageSurfaceBreakup.value;
}

function createResources() {
  return {
    paletteTexture: new THREE.Texture(),
    alphaTexture: new THREE.Texture(),
    sunDirection: new THREE.Vector3(1, 2, 1).normalize(),
  };
}

test('foliage shell and core honor authored surface breakup', () => {
  const resources = createResources();
  const shell = new FoliageShellMaterialFactory().create({
    foliage: FOLIAGE,
    ...resources,
  });
  const core = new FoliageCoreMaterialFactory().create({
    foliage: FOLIAGE,
    ...resources,
  });

  try {
    assert.equal(compileSurfaceBreakup(shell), FOLIAGE.surfaceBreakup);
    assert.equal(compileSurfaceBreakup(core), FOLIAGE.surfaceBreakup);
  } finally {
    shell.dispose();
    core.dispose();
    resources.paletteTexture.dispose();
    resources.alphaTexture.dispose();
  }
});

test('foliage materials preserve legacy breakup defaults when unset', () => {
  const resources = createResources();
  const foliage = { ...FOLIAGE };
  delete foliage.surfaceBreakup;
  const shell = new FoliageShellMaterialFactory().create({ foliage, ...resources });
  const core = new FoliageCoreMaterialFactory().create({ foliage, ...resources });

  try {
    assert.equal(compileSurfaceBreakup(shell), 0.025);
    assert.equal(compileSurfaceBreakup(core), 0.1);
  } finally {
    shell.dispose();
    core.dispose();
    resources.paletteTexture.dispose();
    resources.alphaTexture.dispose();
  }
});
