function requirePositiveFinite(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Configuration '${path}' must be a finite number > 0.`);
  }
  return value;
}

function requirePositiveInteger(value, path) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Configuration '${path}' must be a positive integer.`);
  }
  return value;
}

export function parseTreeStressQaPolicy(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error("Configuration 'tree-stress-qa' must be an object.");
  }
  if (typeof config.fpsRequiresTargetHardware !== 'boolean') {
    throw new Error(
      "Configuration 'tree-stress-qa.fpsRequiresTargetHardware' must be a boolean.",
    );
  }

  return Object.freeze({
    expectedTreeCount: requirePositiveInteger(
      config.expectedTreeCount,
      'tree-stress-qa.expectedTreeCount',
    ),
    maximumColorDrawCalls: requirePositiveInteger(
      config.maximumColorDrawCalls,
      'tree-stress-qa.maximumColorDrawCalls',
    ),
    maximumGpuMegabytes: requirePositiveFinite(
      config.maximumGpuMegabytes,
      'tree-stress-qa.maximumGpuMegabytes',
    ),
    targetFps: requirePositiveFinite(
      config.targetFps,
      'tree-stress-qa.targetFps',
    ),
    fpsRequiresTargetHardware: config.fpsRequiresTargetHardware,
  });
}
