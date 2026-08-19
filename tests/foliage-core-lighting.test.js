import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FoliageCoreMaterialFactory } from '../src/rendering/foliage-core-material-factory.js';
import { FOLIAGE_RENDERING_CONSTANTS } from '../src/rendering/foliage-rendering-constants.js';

const FOLIAGE = Object.freeze({
  variation: 0.08,
  paletteBase: 0.55,
  heightPaletteShift: 0.26,
  exposurePaletteShift: 0.14,
  radialNormalStrength: 0.88,
  crownNormalBlend: 0.68,
  wrapLight: 0.72,
  skyLightStrength: 0.3,
  cavityStrength: 0.22,
  heightLightStrength: 0.2,
  undersideTint: '#9fc0c4',
  undersideStrength: 0.38,
  rimStrength: 0.35,
  rimPower: 2.5,
  translucencyStrength: 0.22,
  surfaceBreakup: 0.02,
  core: Object.freeze({ brightness: 0.62 }),
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

test('foliage core keeps glow recessed behind the outer shell', () => {
  const paletteTexture = new THREE.Texture();
  const material = new FoliageCoreMaterialFactory().create({
    foliage: FOLIAGE,
    paletteTexture,
    sunDirection: new THREE.Vector3(1, 2, 1).normalize(),
  });

  try {
    const shader = createShader();
    material.onBeforeCompile(shader);

    assert.equal(shader.uniforms.uFoliageSurfaceBreakup.value, 0.02);
    assert.equal(
      shader.uniforms.uFoliageRimStrength.value,
      FOLIAGE.rimStrength * FOLIAGE_RENDERING_CONSTANTS.coreRimScale,
    );
    assert.equal(
      shader.uniforms.uFoliageTranslucencyStrength.value,
      FOLIAGE.translucencyStrength *
        FOLIAGE_RENDERING_CONSTANTS.coreTranslucencyScale,
    );
  } finally {
    material.dispose();
    paletteTexture.dispose();
  }
});
