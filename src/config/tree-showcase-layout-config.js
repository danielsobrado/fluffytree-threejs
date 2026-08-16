function requireFinite(value, path) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`Configuration '${path}' must be finite.`);
  }
  return value;
}

function requirePosition(value, path) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new TypeError(`Configuration '${path}' must contain three numbers.`);
  }
  return Object.freeze(
    value.map((item, index) => requireFinite(item, `${path}[${index}]`)),
  );
}

export function parseTreeShowcaseLayout(config) {
  if (!Array.isArray(config?.layout) || config.layout.length === 0) {
    throw new TypeError("Tree showcase configuration must define a non-empty 'layout'.");
  }

  return Object.freeze(
    config.layout.map((entry, index) => {
      const path = `treeShowcase.layout[${index}]`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new TypeError(`Configuration '${path}' must be an object.`);
      }
      if (typeof entry.preset !== 'string' || entry.preset.trim() === '') {
        throw new TypeError(`Configuration '${path}.preset' must be a non-empty string.`);
      }
      if (
        !Number.isSafeInteger(entry.seed) ||
        entry.seed < 0 ||
        entry.seed > 0xffffffff
      ) {
        throw new RangeError(
          `Configuration '${path}.seed' must be an unsigned 32-bit integer.`,
        );
      }
      return Object.freeze({
        preset: entry.preset,
        seed: entry.seed,
        position: requirePosition(entry.position, `${path}.position`),
        rotationY: requireFinite(entry.rotationY ?? 0, `${path}.rotationY`),
      });
    }),
  );
}
