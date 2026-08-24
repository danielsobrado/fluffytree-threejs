import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { attachDepthTexture } from '../src/rendering/post-pipeline.js';

test('post-processing depth texture matches the physical render target size', () => {
  const target = new THREE.WebGLRenderTarget(320, 180);
  target.setSize(640, 360);

  const depthTexture = attachDepthTexture(target);

  assert.equal(depthTexture.image.width, target.width);
  assert.equal(depthTexture.image.height, target.height);
  target.dispose();
});

test('render target resizing keeps an attached depth texture in sync', () => {
  const target = new THREE.WebGLRenderTarget(320, 180);
  const depthTexture = attachDepthTexture(target);

  target.setSize(800, 450);

  assert.equal(depthTexture.image.width, 800);
  assert.equal(depthTexture.image.height, 450);
  target.dispose();
});
