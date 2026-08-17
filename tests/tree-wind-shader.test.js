import assert from 'node:assert/strict';
import test from 'node:test';
import {
  configureTreeWindMaterial,
  injectTreeWindVertexShader,
} from '../src/rendering/tree-wind-shader.js';

function createMaterial() {
  return { userData: {}, needsUpdate: false };
}

function createShader() {
  return {
    uniforms: {},
    vertexShader: 'void main() { #include <begin_vertex> }',
  };
}

test('tree wind compensates instance rotation and scale before object-space sway', () => {
  const source = injectTreeWindVertexShader(
    'void main() { #include <begin_vertex> }',
  );

  assert.match(source, /treeWindObjectOffset/);
  assert.match(source, /treeWindInstanceBasis/);
  assert.match(
    source,
    /dot\( treeWindInstanceBasis\[ 0 \], treeWindObjectOffset \)/,
  );
  assert.doesNotMatch(source, /instanceMatrix\[ 3 \]\.x \* 0\.73/);
  assert.doesNotMatch(source, /treeWindInstancePhase/);
});

test('tree wind uses instance crown height for coherent sway weight', () => {
  const source = injectTreeWindVertexShader(
    'void main() { #include <begin_vertex> }',
  );

  assert.match(
    source,
    /instanceMatrix\[ 3 \]\.y \/ max\( uTreeWindTreeHeight/,
  );
});

test('tree wind deformation is zero at capture time for any seeded phase', () => {
  const source = injectTreeWindVertexShader(
    'void main() { #include <begin_vertex> }',
  );

  assert.match(source, /sin\(uTreeWindPhase\)/);
  assert.match(source, /treeWindSecondaryPhase/);
  assert.match(source, /sin\(treeWindSecondaryPhase\)/);
});

test('tree wind material exposes one mutable state', () => {
  const material = createMaterial();
  configureTreeWindMaterial(material, { cacheKey: 'wind-test' });
  const shader = createShader();

  material.onBeforeCompile(shader);

  assert.equal(material.userData.windState.time, 0);
  assert.equal(material.userData.windState.treeHeight, 1);
  assert.equal(shader.uniforms.uTreeWindTreeHeight.value, 1);
  material.userData.windState.treeHeight = 8;
  assert.equal(shader.uniforms.uTreeWindTreeHeight.value, 8);
  assert.equal(material.customProgramCacheKey(), 'wind-test');
  assert.equal(material.needsUpdate, true);
});
