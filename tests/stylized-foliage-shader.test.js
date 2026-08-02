import assert from 'node:assert/strict';
import test from 'node:test';
import { configureStylizedFoliageShader } from '../src/rendering/stylized-foliage-shader.js';

function createDirection() {
  return {
    clone() {
      return createDirection();
    },
    normalize() {
      return this;
    },
  };
}

function createMaterial() {
  return {
    userData: {},
    needsUpdate: false,
  };
}

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

const foliage = Object.freeze({
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
});

function configure(material, overrides = {}) {
  configureStylizedFoliageShader(material, {
    foliage,
    paletteTexture: { name: 'palette' },
    sunDirection: createDirection(),
    radialNormalExpression: 'normalize( position )',
    heightExpression: 'position.y * 0.5 + 0.5',
    cacheKey: 'test-shader',
    ...overrides,
  });
}

test('stylized foliage shader installs crown-aware attributes and lighting', () => {
  const material = createMaterial();
  const paletteTexture = { name: 'palette' };
  configure(material, { paletteTexture });

  const shader = createShader();
  material.onBeforeCompile(shader);

  assert.match(shader.vertexShader, /attribute float instanceColorMix/);
  assert.match(shader.vertexShader, /attribute float instanceExposure/);
  assert.match(shader.vertexShader, /attribute vec3 instanceCrownDirection/);
  assert.match(shader.vertexShader, /uFoliageCrownNormalBlend/);
  assert.match(shader.vertexShader, /foliageCrownRadialWorld/);
  assert.match(shader.vertexShader, /foliageRadialLocal/);
  assert.match(shader.vertexShader, /vFoliagePaletteCoordinate/);
  assert.match(shader.fragmentShader, /uniform sampler2D uFoliagePalette/);
  assert.match(shader.fragmentShader, /foliageWrappedLight/);
  assert.match(shader.fragmentShader, /foliageCavityFactor/);
  assert.equal(shader.uniforms.uFoliagePalette.value, paletteTexture);
  assert.equal(shader.uniforms.uFoliageCrownNormalBlend.value, 0.5);
  assert.equal(material.customProgramCacheKey(), 'test-shader');
  assert.equal(material.needsUpdate, true);
  assert.deepEqual(material.userData.disposables, [paletteTexture]);
});

test('shell shader replaces card normals with crown-aware radial normals', () => {
  const material = createMaterial();
  configure(material, { forceRadialFragmentNormal: true });

  const shader = createShader();
  material.onBeforeCompile(shader);

  assert.match(
    shader.fragmentShader,
    /normal = normalize\( mat3\( viewMatrix \) \* vFoliageRadialWorld \)/,
  );
});
