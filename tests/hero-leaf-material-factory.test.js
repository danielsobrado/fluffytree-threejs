import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { HeroLeafMaterialFactory } from '../src/rendering/hero-leaf-material-factory.js';

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
  undersideStrength: 0.3,
  rimStrength: 0.3,
  rimPower: 2.5,
  translucencyStrength: 0.2,
  surfaceBreakup: 0.02,
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

test('hero leaf material shares the stylized canopy shader language', () => {
  const paletteTexture = new THREE.Texture();
  const material = new HeroLeafMaterialFactory().create({
    foliage: FOLIAGE,
    settings: { roughness: 0.91 },
    paletteTexture,
    sunDirection: new THREE.Vector3(1, 2, 1).normalize(),
  });

  try {
    const shader = createShader();
    material.onBeforeCompile(shader);

    assert.equal(material.name, 'leaf-detail-material');
    assert.equal(material.roughness, 0.91);
    assert.equal(material.side, THREE.DoubleSide);
    assert.equal(material.customProgramCacheKey(), 'hero-leaf-stylized-v1');
    assert.equal(shader.uniforms.uFoliageSurfaceBreakup.value, 0.02);
    assert.equal(shader.uniforms.uFoliagePalette.value, paletteTexture);
    assert.match(shader.vertexShader, /attribute float instanceExposure/);
    assert.match(shader.vertexShader, /attribute vec3 instanceCrownDirection/);
    assert.match(shader.vertexShader, /foliageRadialLocal = objectNormal/);
  } finally {
    material.dispose();
    paletteTexture.dispose();
  }
});
