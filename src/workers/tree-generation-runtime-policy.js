function requireBoolean(value, path) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${path} must be boolean.`);
  }
  return value;
}

function requirePositiveInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${path} must be a positive integer.`);
  }
  return value;
}

function requireNonNegativeInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${path} must be a non-negative integer.`);
  }
  return value;
}

export function parseTreeGenerationRuntimePolicy(config) {
  const source = config?.workers;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('treeGenerationRuntime.workers must be an object.');
  }

  return Object.freeze({
    enabled: requireBoolean(source.enabled, 'treeGenerationRuntime.workers.enabled'),
    maximumWorkers: requirePositiveInteger(
      source.maximumWorkers,
      'treeGenerationRuntime.workers.maximumWorkers',
    ),
    reserveLogicalCores: requireNonNegativeInteger(
      source.reserveLogicalCores,
      'treeGenerationRuntime.workers.reserveLogicalCores',
    ),
    terminateOnCancel: requireBoolean(
      source.terminateOnCancel,
      'treeGenerationRuntime.workers.terminateOnCancel',
    ),
    maximumCachedResults: requirePositiveInteger(
      source.maximumCachedResults,
      'treeGenerationRuntime.workers.maximumCachedResults',
    ),
  });
}

export function resolveTreeGenerationWorkerCount(
  policy,
  hardwareConcurrency = globalThis.navigator?.hardwareConcurrency,
) {
  if (!policy?.enabled) return 0;

  const logicalCores =
    Number.isSafeInteger(hardwareConcurrency) && hardwareConcurrency > 0
      ? hardwareConcurrency
      : 1;
  const availableCores = Math.max(1, logicalCores - policy.reserveLogicalCores);
  return Math.min(policy.maximumWorkers, availableCores);
}
