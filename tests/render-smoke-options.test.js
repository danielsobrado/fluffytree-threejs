import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseRenderSmokeMode,
  parseRenderSmokePort,
} from '../tools/render-smoke-options.js';

test('render smoke port accepts only valid TCP ports', () => {
  assert.equal(parseRenderSmokePort(), 4173);
  assert.equal(parseRenderSmokePort('8080'), 8080);

  for (const value of [0, -1, 1.5, 65536, 'not-a-port']) {
    assert.throws(() => parseRenderSmokePort(value), /RENDER_SMOKE_PORT/);
  }
});

test('render smoke mode rejects unsupported QA modes', () => {
  for (const mode of ['render-smoke', 'stress', 'solidity', 'manifold']) {
    assert.equal(parseRenderSmokeMode(mode), mode);
  }

  assert.throws(
    () => parseRenderSmokeMode('typo'),
    /RENDER_SMOKE_QA_MODE/,
  );
});
