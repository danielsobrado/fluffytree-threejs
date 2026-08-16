const RESPONSE_FIELDS = Object.freeze([
  'phototropism',
  'windShaping',
  'slopeAdaptation',
  'competitionSensitivity',
  'pruningSensitivity',
]);

function requireUnit(value, path) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`Configuration '${path}' must be within [0, 1].`);
  }
  return value;
}

export function parseTreeEnvironmentResponse(value = {}, path = 'environmentResponse') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Configuration '${path}' must be an object.`);
  }
  const parsed = {};
  for (const field of RESPONSE_FIELDS) {
    parsed[field] = requireUnit(value[field] ?? 0, `${path}.${field}`);
  }
  return Object.freeze(parsed);
}
