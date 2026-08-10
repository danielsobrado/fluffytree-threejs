const MAXIMUM_SEED = 0xffffffff;
const LOD_COUNT = 4;

function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Configuration '${path}' must be an object.`);
  }
  return value;
}

function requirePositiveInteger(value, path) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Configuration '${path}' must be a positive integer.`);
  }
  return value;
}

function requireUint32(value, path) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAXIMUM_SEED) {
    throw new Error(`Configuration '${path}' must be an unsigned 32-bit integer.`);
  }
  return value;
}

function requireBudgetArray(value, path) {
  if (!Array.isArray(value) || value.length !== LOD_COUNT) {
    throw new Error(`Configuration '${path}' must contain exactly ${LOD_COUNT} values.`);
  }
  return Object.freeze(
    value.map((entry, index) =>
      requirePositiveInteger(entry, `${path}[${index}]`),
    ),
  );
}

export function parseTreeLodQaPolicy(config) {
  const budgets = requireObject(config?.budgets, 'tree-lod-qa.budgets');
  const sweep = requireObject(config?.sweep, 'tree-lod-qa.sweep');

  return Object.freeze({
    budgets: Object.freeze({
      maximumTriangles: requireBudgetArray(
        budgets.maximumTriangles,
        'tree-lod-qa.budgets.maximumTriangles',
      ),
      maximumDrawCalls: requireBudgetArray(
        budgets.maximumDrawCalls,
        'tree-lod-qa.budgets.maximumDrawCalls',
      ),
      maximumShadowTriangles: requirePositiveInteger(
        budgets.maximumShadowTriangles,
        'tree-lod-qa.budgets.maximumShadowTriangles',
      ),
    }),
    sweep: Object.freeze({
      seedCount: requirePositiveInteger(
        sweep.seedCount,
        'tree-lod-qa.sweep.seedCount',
      ),
      firstSeed: requireUint32(
        sweep.firstSeed,
        'tree-lod-qa.sweep.firstSeed',
      ),
      seedStep: requirePositiveInteger(
        sweep.seedStep,
        'tree-lod-qa.sweep.seedStep',
      ),
    }),
  });
}
