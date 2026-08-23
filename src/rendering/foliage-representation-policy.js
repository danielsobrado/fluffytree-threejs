const LEAF_GEOMETRY_SHAPES = Object.freeze(['diamond', 'oval']);

function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Configuration '${path}' must be an object.`);
  }
  return value;
}

function requireNumber(value, minimum, maximum, path) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new RangeError(
      `Configuration '${path}' must be within [${minimum}, ${maximum}].`,
    );
  }
  return number;
}

function requireInteger(value, minimum, maximum, path) {
  const number = requireNumber(value, minimum, maximum, path);
  if (!Number.isInteger(number)) {
    throw new RangeError(`Configuration '${path}' must be an integer.`);
  }
  return number;
}

function parseRole(value, path, includeInteriorDensity) {
  const role = requireObject(value, path);
  const parsed = {
    shellDensity: requireNumber(role.shellDensity, 0, 1, `${path}.shellDensity`),
    leafDensityMultiplier: requireNumber(
      role.leafDensityMultiplier,
      0,
      12,
      `${path}.leafDensityMultiplier`,
    ),
    leafLayerCount: requireInteger(
      role.leafLayerCount,
      1,
      4,
      `${path}.leafLayerCount`,
    ),
  };

  if (includeInteriorDensity) {
    parsed.shellInteriorDensity = requireNumber(
      role.shellInteriorDensity,
      0,
      1,
      `${path}.shellInteriorDensity`,
    );
  }

  return Object.freeze(parsed);
}

function parseGeometry(value, path) {
  const geometry = requireObject(value, path);
  if (!LEAF_GEOMETRY_SHAPES.includes(geometry.shape)) {
    throw new RangeError(
      `Configuration '${path}.shape' must be one of ${LEAF_GEOMETRY_SHAPES.join(', ')}.`,
    );
  }

  const shoulderRatio = requireNumber(
    geometry.shoulderRatio,
    0.1,
    0.55,
    `${path}.shoulderRatio`,
  );
  const midRatio = requireNumber(geometry.midRatio, 0.25, 0.9, `${path}.midRatio`);
  if (midRatio <= shoulderRatio) {
    throw new RangeError(
      `Configuration '${path}.midRatio' must be greater than shoulderRatio.`,
    );
  }

  return Object.freeze({
    shape: geometry.shape,
    lengthMultiplier: requireNumber(
      geometry.lengthMultiplier,
      0.5,
      2,
      `${path}.lengthMultiplier`,
    ),
    widthMultiplier: requireNumber(
      geometry.widthMultiplier,
      0.5,
      2,
      `${path}.widthMultiplier`,
    ),
    shoulderRatio,
    midRatio,
    shoulderWidthRatio: requireNumber(
      geometry.shoulderWidthRatio,
      0.2,
      1,
      `${path}.shoulderWidthRatio`,
    ),
  });
}

function parseProfile(value, path) {
  const profile = requireObject(value, path);
  return Object.freeze({
    hero: parseRole(profile.hero, `${path}.hero`, true),
    near: parseRole(profile.near, `${path}.near`, false),
    geometry: parseGeometry(profile.geometry, `${path}.geometry`),
    orientation: Object.freeze({
      tiltRadians: requireNumber(
        requireObject(profile.orientation, `${path}.orientation`).tiltRadians,
        0,
        1.2,
        `${path}.orientation.tiltRadians`,
      ),
    }),
  });
}

export function parseFoliageRepresentationPolicy(config) {
  const profiles = requireObject(config?.profiles, 'profiles');
  if (!profiles.default) {
    throw new Error("Foliage rendering policy requires a 'default' profile.");
  }

  return Object.freeze({
    profiles: Object.freeze(
      Object.fromEntries(
        Object.entries(profiles).map(([id, value]) => [
          id,
          parseProfile(value, `profiles.${id}`),
        ]),
      ),
    ),
  });
}

export function resolveFoliageRepresentationProfile(policy, leafShape) {
  if (!policy) return null;
  return policy.profiles[leafShape] ?? policy.profiles.default;
}
