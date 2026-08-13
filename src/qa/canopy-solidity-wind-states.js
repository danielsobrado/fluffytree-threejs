function isWindSensitiveState(state) {
  return state.assignments.some(
    (assignment) => assignment.fade > 0 && assignment.index <= 2,
  );
}

function validateSampleTimes(sampleTimes) {
  if (!Array.isArray(sampleTimes) || sampleTimes.length === 0) {
    throw new TypeError('Wind solidity sample times must be a non-empty array.');
  }
  if (!sampleTimes.every((time) => Number.isFinite(time) && time >= 0)) {
    throw new RangeError('Wind solidity sample times must be finite and non-negative.');
  }
}

export function createWindSolidityStates(lodStates, sampleTimes) {
  if (!Array.isArray(lodStates)) {
    throw new TypeError('Wind solidity LOD states must be an array.');
  }
  validateSampleTimes(sampleTimes);

  const windSensitiveStates = lodStates.filter(isWindSensitiveState);
  return Object.freeze(
    sampleTimes.flatMap((time, sampleIndex) =>
      windSensitiveStates.map((sourceState) =>
        Object.freeze({
          time,
          sourceState,
          captureState: Object.freeze({
            id: `${sourceState.id}-wind-${sampleIndex + 1}`,
            kind: 'wind',
            projectedPixelsKey: sourceState.projectedPixelsKey,
          }),
        }),
      ),
    ),
  );
}
