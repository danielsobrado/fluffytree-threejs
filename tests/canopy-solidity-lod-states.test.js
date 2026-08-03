import assert from 'node:assert/strict';
import test from 'node:test';
import { CANOPY_SOLIDITY_LOD_STATES } from '../src/qa/canopy-solidity-lod-states.js';

const EXPECTED_IDS = Object.freeze([
  'lod0',
  'lod1',
  'lod2',
  'lod3',
  'lod0-lod1',
  'lod1-lod2',
  'lod2-lod3',
]);

test('solidity QA covers every rendered LOD and adjacent transition', () => {
  assert.deepEqual(
    CANOPY_SOLIDITY_LOD_STATES.map((state) => state.id),
    EXPECTED_IDS,
  );
});

test('every solidity LOD state preserves a full unit of representation weight', () => {
  for (const state of CANOPY_SOLIDITY_LOD_STATES) {
    const total = state.assignments.reduce(
      (sum, assignment) => sum + assignment.fade,
      0,
    );
    assert.equal(total, 1, state.id);
  }
});

test('pure LOD states activate exactly one level without inversion', () => {
  const pureStates = CANOPY_SOLIDITY_LOD_STATES.filter(
    (state) => state.kind === 'level',
  );

  pureStates.forEach((state, index) => {
    const active = state.assignments.filter((assignment) => assignment.fade > 0);
    assert.deepEqual(active, [{ index, fade: 1, invert: false }]);
  });
});

test('transition states use complementary half fades on adjacent levels', () => {
  const transitions = CANOPY_SOLIDITY_LOD_STATES.filter(
    (state) => state.kind === 'transition',
  );

  transitions.forEach((state, index) => {
    const active = state.assignments.filter((assignment) => assignment.fade > 0);
    assert.deepEqual(active, [
      { index, fade: 0.5, invert: false },
      { index: index + 1, fade: 0.5, invert: true },
    ]);
  });
});
