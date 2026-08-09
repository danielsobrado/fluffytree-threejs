import {
  INTEGER_RULES,
  NON_NEGATIVE_NUMBER_PATHS,
  OPTIONAL_NUMBER_PATHS,
  PAIR_RULES,
  POSITIVE_NUMBER_PATHS,
  REQUIRED_NUMBER_PATHS,
  STRING_ARRAY_RULES,
  UNIT_INTERVAL_PATHS,
} from './tree-preset-validation-rules.js';

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readPath(source, path) {
  return path
    .split('.')
    .reduce((value, key) => (value === undefined ? undefined : value?.[key]), source);
}

function configurationPath(id, path) {
  return `${id}.${path}`;
}

function requireFiniteNumber(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Configuration '${path}' must be a finite number.`);
  }
  return value;
}

function requireNonEmptyString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Configuration '${path}' must be a non-empty string.`);
  }
}

function requireStringArray(value, path, minimumLength) {
  if (!Array.isArray(value) || value.length < minimumLength) {
    throw new Error(
      `Configuration '${path}' must contain at least ${minimumLength} strings.`,
    );
  }

  for (const item of value) requireNonEmptyString(item, path);
}

function requireInteger(value, path, minimum) {
  requireFiniteNumber(value, path);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`Configuration '${path}' must be an integer >= ${minimum}.`);
  }
}

function requirePair(value, path, { positive = false, integer = false } = {}) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`Configuration '${path}' must contain exactly two numbers.`);
  }

  for (const item of value) {
    requireFiniteNumber(item, path);
    if (positive && item <= 0) {
      throw new Error(`Configuration '${path}' must contain positive numbers.`);
    }
    if (integer && !Number.isInteger(item)) {
      throw new Error(`Configuration '${path}' must contain integers.`);
    }
  }

  if (positive && value[1] < value[0]) {
    throw new Error(`Configuration '${path}' must be [minimum, maximum].`);
  }
}

function validateNumericTypes(id, value) {
  for (const path of REQUIRED_NUMBER_PATHS) {
    requireFiniteNumber(readPath(value, path), configurationPath(id, path));
  }

  for (const path of OPTIONAL_NUMBER_PATHS) {
    const candidate = readPath(value, path);
    if (candidate !== undefined) {
      requireFiniteNumber(candidate, configurationPath(id, path));
    }
  }
}

function validatePhysicalDimensions(id, value) {
  for (const path of POSITIVE_NUMBER_PATHS) {
    if (readPath(value, path) <= 0) {
      throw new Error(`Configuration '${configurationPath(id, path)}' must be > 0.`);
    }
  }

  for (const path of NON_NEGATIVE_NUMBER_PATHS) {
    if (readPath(value, path) < 0) {
      throw new Error(`Configuration '${configurationPath(id, path)}' must be >= 0.`);
    }
  }

  for (const path of UNIT_INTERVAL_PATHS) {
    const candidate = readPath(value, path);
    if (candidate < 0 || candidate > 1) {
      throw new Error(`Configuration '${configurationPath(id, path)}' must be within [0, 1].`);
    }
  }

  if (value.trunk.topRadius > value.trunk.baseRadius) {
    throw new Error(
      `Configuration '${id}.trunk.topRadius' must not exceed '${id}.trunk.baseRadius'.`,
    );
  }
}

function validateCounts(id, value) {
  for (const { path, minimum } of INTEGER_RULES) {
    requireInteger(readPath(value, path), configurationPath(id, path), minimum);
  }
}

function validateStructureRelationships(id, value) {
  if (value.trunk.branching.primaryCount > value.crown.lobeCount) {
    throw new Error(
      `Configuration '${id}.trunk.branching.primaryCount' must not exceed '${id}.crown.lobeCount'.`,
    );
  }

  if (value.crown.clumps.macroCount > value.crown.lobeCount) {
    throw new Error(
      `Configuration '${id}.crown.clumps.macroCount' must not exceed '${id}.crown.lobeCount'.`,
    );
  }
}

function validatePairs(id, value) {
  for (const { path, positive, integer } of PAIR_RULES) {
    requirePair(readPath(value, path), configurationPath(id, path), {
      positive,
      integer,
    });
  }
}

function validateStrings(id, value) {
  requireNonEmptyString(value.trunk?.color, `${id}.trunk.color`);
  for (const { path, minimumLength } of STRING_ARRAY_RULES) {
    requireStringArray(
      readPath(value, path),
      configurationPath(id, path),
      minimumLength,
    );
  }
}

export function validateTreePresetConfig(id, value) {
  requireNonEmptyString(id, 'tree preset id');
  if (!isObject(value)) {
    throw new Error(`Configuration '${id}' must be an object.`);
  }

  if (value.label !== undefined) {
    requireNonEmptyString(value.label, `${id}.label`);
  }

  validateNumericTypes(id, value);
  validatePhysicalDimensions(id, value);
  validateCounts(id, value);
  validateStructureRelationships(id, value);
  validatePairs(id, value);
  validateStrings(id, value);

  return value;
}
