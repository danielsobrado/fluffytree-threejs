import assert from 'node:assert/strict';
import test from 'node:test';
import { isPostProcessingEnabled } from '../src/rendering/post-processing-mode.js';

test('the grade runs for an ordinary viewer', () => {
  assert.equal(isPostProcessingEnabled(''), true);
  assert.equal(isPostProcessingEnabled('?scene=forest'), true);
});

test('the grade stays off under QA, which measures the ungraded image', () => {
  assert.equal(isPostProcessingEnabled('?qa=solidity'), false);
  assert.equal(isPostProcessingEnabled('?qa=render-smoke'), false);
  assert.equal(isPostProcessingEnabled('?qa=render-smoke&wind=off'), false);
});

test('a QA run can ask for the grade by name, to capture it', () => {
  assert.equal(isPostProcessingEnabled('?qa=render-smoke&post=on'), true);
});

test('a viewer can turn the grade off', () => {
  assert.equal(isPostProcessingEnabled('?post=off'), false);
  assert.equal(isPostProcessingEnabled('?post=0'), false);
});
