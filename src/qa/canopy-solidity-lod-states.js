const LEVEL_COUNT = 4;
const TRANSITION_FADE = 0.5;

function createAssignments(active) {
  return Object.freeze(
    Array.from({ length: LEVEL_COUNT }, (_, index) => {
      const assignment = active.get(index);
      return Object.freeze({
        index,
        fade: assignment?.fade ?? 0,
        invert: assignment?.invert ?? false,
      });
    }),
  );
}

function createLevelState(index) {
  return Object.freeze({
    id: `lod${index}`,
    kind: 'level',
    assignments: createAssignments(
      new Map([[index, { fade: 1, invert: false }]]),
    ),
  });
}

function createTransitionState(nearIndex, farIndex, projectedPixelsKey) {
  return Object.freeze({
    id: `lod${nearIndex}-lod${farIndex}`,
    kind: 'transition',
    projectedPixelsKey,
    assignments: createAssignments(
      new Map([
        [nearIndex, { fade: TRANSITION_FADE, invert: false }],
        [farIndex, { fade: TRANSITION_FADE, invert: true }],
      ]),
    ),
  });
}

export const CANOPY_SOLIDITY_LOD_STATES = Object.freeze([
  createLevelState(0),
  createLevelState(1),
  createLevelState(2),
  createLevelState(3),
  createTransitionState(0, 1, 'nearPixels'),
  createTransitionState(1, 2, 'mediumPixels'),
  createTransitionState(2, 3, 'farPixels'),
]);
