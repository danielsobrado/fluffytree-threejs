import assert from 'node:assert/strict';
import test from 'node:test';
import { CANOPY_SOLIDITY_LOD_STATES } from '../src/qa/canopy-solidity-lod-states.js';
import { createWindSolidityStates } from '../src/qa/canopy-solidity-wind-states.js';

test('wind solidity samples every wind-sensitive LOD and transition', () => {
  const states = createWindSolidityStates(CANOPY_SOLIDITY_LOD_STATES, [0.85, 1.7]);

  assert.equal(states.length, 12);
  assert.ok(states.some((state) => state.captureState.id === 'lod0-wind-1'));
  assert.ok(states.some((state) => state.captureState.id === 'lod1-lod2-wind-2'));
  assert.ok(states.some((state) => state.captureState.id === 'lod2-lod3-wind-2'));
  assert.ok(!states.some((state) => state.captureState.id.startsWith('lod3-wind-')));
});

test('wind solidity rejects invalid sample times', () => {
  assert.throws(
    () => createWindSolidityStates(CANOPY_SOLIDITY_LOD_STATES, []),
    /non-empty array/,
  );
  assert.throws(
    () => createWindSolidityStates(CANOPY_SOLIDITY_LOD_STATES, [Number.NaN]),
    /finite and non-negative/,
  );
});
