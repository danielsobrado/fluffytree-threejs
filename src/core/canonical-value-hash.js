const HASH_SEED_A = 0x811c9dc5;
const HASH_SEED_B = 0x9e3779b9;
const HASH_PRIME = 0x01000193;

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function createHashState() {
  return { a: HASH_SEED_A, b: HASH_SEED_B, length: 0 };
}

function updateHash(state, text) {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    state.a = Math.imul(state.a ^ code, HASH_PRIME) >>> 0;
    state.b = Math.imul(state.b ^ (code + 0x9d), HASH_PRIME) >>> 0;
    state.b ^= state.b >>> 13;
    state.length += 1;
  }
}

function visit(value, state, path, stack) {
  if (value === null) {
    updateHash(state, 'null;');
    return;
  }

  const type = typeof value;
  if (type === 'string') {
    updateHash(state, `s${JSON.stringify(value)};`);
    return;
  }
  if (type === 'boolean') {
    updateHash(state, value ? 'b1;' : 'b0;');
    return;
  }
  if (type === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Canonical value '${path}' must be a finite number.`);
    }
    updateHash(state, `n${Object.is(value, -0) ? 0 : value};`);
    return;
  }
  if (type !== 'object') {
    throw new TypeError(
      `Canonical value '${path}' contains unsupported type '${type}'.`,
    );
  }
  if (stack.has(value)) {
    throw new TypeError(`Canonical value '${path}' contains a cycle.`);
  }

  stack.add(value);
  try {
    if (Array.isArray(value)) {
      updateHash(state, `a${value.length}[`);
      for (let index = 0; index < value.length; index += 1) {
        visit(value[index], state, `${path}[${index}]`, stack);
      }
      updateHash(state, '];');
      return;
    }

    if (!isPlainObject(value)) {
      throw new TypeError(`Canonical value '${path}' must use plain objects.`);
    }
    const keys = Object.keys(value).sort();
    updateHash(state, `o${keys.length}{`);
    for (const key of keys) {
      updateHash(state, `k${JSON.stringify(key)}:`);
      visit(value[key], state, `${path}.${key}`, stack);
    }
    updateHash(state, '};');
  } finally {
    stack.delete(value);
  }
}

function hex(value) {
  return value.toString(16).padStart(8, '0');
}

export function hashCanonicalValue(value) {
  const state = createHashState();
  visit(value, state, 'root', new Set());
  return `${hex(state.a)}${hex(state.b)}-${state.length.toString(16)}`;
}

export function assertCanonicalValue(value, label = 'value') {
  try {
    hashCanonicalValue(value);
  } catch (error) {
    throw new TypeError(`${label} must be canonical serializable data.`, {
      cause: error,
    });
  }
  return value;
}
