import assert from 'node:assert/strict';
import test from 'node:test';
import {
  configureTreeIrFoliageLighting,
  injectTreeIrFoliageLighting,
} from '../src/rendering/tree-ir-foliage-lighting.js';

const FRAGMENT_SHADER = `
  varying vec3 vViewPosition;
  void main() {
    vec3 normal = vec3(0.0, 1.0, 0.0);
    vec4 diffuseColor = vec4(1.0);
    vec3 outgoingLight = vec3(0.0);
    #include <opaque_fragment>
  }
`;

test('native foliage lighting injects before the opaque fragment', () => {
  const injected = injectTreeIrFoliageLighting(FRAGMENT_SHADER);

  assert.match(injected, /treeFoliageRim/);
  assert.match(injected, /gl_FrontFacing/);
  assert.ok(
    injected.indexOf('treeFoliageRim') < injected.indexOf('#include <opaque_fragment>'),
  );
});

test('native foliage lighting composes with existing material compilation', () => {
  let previousCompileCalled = false;
  let previousCompileThis = null;
  let previousCompileRenderer = null;
  const renderer = { id: 'renderer' };
  const material = {
    userData: {},
    onBeforeCompile(shader, receivedRenderer) {
      previousCompileCalled = true;
      previousCompileThis = this;
      previousCompileRenderer = receivedRenderer;
      shader.vertexShader += '\n// previous';
    },
    customProgramCacheKey: () => 'base-material',
    needsUpdate: false,
  };

  configureTreeIrFoliageLighting(material, {
    softLight: 0.018,
    rimLight: 0.045,
    backLight: 0.03,
  });
  const shader = {
    uniforms: {},
    vertexShader: 'void main() {}',
    fragmentShader: FRAGMENT_SHADER,
  };
  material.onBeforeCompile(shader, renderer);

  assert.equal(previousCompileCalled, true);
  assert.equal(previousCompileThis, material);
  assert.equal(previousCompileRenderer, renderer);
  assert.equal(shader.uniforms.uTreeFoliageSoftLight.value, 0.018);
  assert.equal(shader.uniforms.uTreeFoliageRimLight.value, 0.045);
  assert.equal(shader.uniforms.uTreeFoliageBackLight.value, 0.03);
  assert.match(shader.fragmentShader, /treeFoliageBackface/);
  assert.match(material.customProgramCacheKey(), /tree-ir-foliage-lighting-v1/);
  assert.equal(material.userData.foliageLighting.rimLight, 0.045);
});

test('native foliage lighting fails loudly when Three shader structure changes', () => {
  assert.throws(
    () => injectTreeIrFoliageLighting('void main() {}'),
    /opaque fragment marker/,
  );
});
