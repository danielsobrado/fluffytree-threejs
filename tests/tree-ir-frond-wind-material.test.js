import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { configureTreeIrFrondWindMaterial } from '../src/rendering/tree-ir-frond-wind-material.js';

test('palm frond wind material combines coherent sway with zero-based local flutter', () => {
  const material = configureTreeIrFrondWindMaterial(
    new THREE.MeshStandardMaterial(),
  );
  const shader = {
    uniforms: {},
    vertexShader: 'void main() {\n#include <begin_vertex>\n}',
  };

  try {
    material.onBeforeCompile(shader);
    assert.ok(shader.vertexShader.includes('treeFrondWindWeight'));
    assert.ok(shader.vertexShader.includes('treeFrondWindPhase'));
    assert.ok(shader.vertexShader.includes('uniform float uTreeWindTime'));
    assert.ok(shader.vertexShader.includes('treePrimary'));
    assert.ok(shader.vertexShader.includes('treeCross'));
    assert.ok(shader.vertexShader.includes('frondFlutter'));
    assert.ok(shader.vertexShader.includes('sin(frondFlutterPhase)'));
    assert.ok(shader.uniforms.uTreeWindTime);
    assert.ok(material.userData.windState);
    assert.equal(material.customProgramCacheKey(), 'tree-ir-frond-wind-v3');
  } finally {
    material.dispose();
  }
});
