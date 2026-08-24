const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const MAXIMUM_SEED = 0xffffffff;

function optionalObject(parent, key, path) {
  if (parent[key] === undefined) return null;
  const value = parent[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Scene configuration '${path}.${key}' must be an object.`);
  }
  return value;
}

function optionalBoolean(parent, key, path) {
  if (parent[key] === undefined) return;
  if (typeof parent[key] !== 'boolean') {
    throw new Error(`Scene configuration '${path}.${key}' must be boolean.`);
  }
}

function optionalFinite(parent, key, path, { minimum = null, maximum = null } = {}) {
  if (parent[key] === undefined) return undefined;
  const value = parent[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Scene configuration '${path}.${key}' must be a finite number.`);
  }
  if (minimum !== null && value < minimum) {
    throw new Error(`Scene configuration '${path}.${key}' must be >= ${minimum}.`);
  }
  if (maximum !== null && value > maximum) {
    throw new Error(`Scene configuration '${path}.${key}' must be <= ${maximum}.`);
  }
  return value;
}

function optionalPositive(parent, key, path) {
  const value = optionalFinite(parent, key, path);
  if (value !== undefined && value <= 0) {
    throw new Error(`Scene configuration '${path}.${key}' must be > 0.`);
  }
  return value;
}

function optionalSeed(parent, key, path) {
  const value = optionalFinite(parent, key, path, {
    minimum: 0,
    maximum: MAXIMUM_SEED,
  });
  if (value !== undefined && !Number.isSafeInteger(value)) {
    throw new Error(
      `Scene configuration '${path}.${key}' must be an unsigned 32-bit integer.`,
    );
  }
}

function optionalColorList(parent, key, path) {
  if (parent[key] === undefined) return;
  const value = parent[key];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((color) => typeof color !== 'string' || !HEX_COLOR_PATTERN.test(color))
  ) {
    throw new Error(
      `Scene configuration '${path}.${key}' must contain #RRGGBB colors.`,
    );
  }
}

function validateContactShadow(scene) {
  const settings = optionalObject(scene, 'contactShadow', 'scene');
  if (!settings) return;

  optionalBoolean(settings, 'enabled', 'scene.contactShadow');
  optionalFinite(settings, 'radiusScale', 'scene.contactShadow', { minimum: 0 });
  optionalFinite(settings, 'strength', 'scene.contactShadow', {
    minimum: 0,
    maximum: 1,
  });
  optionalFinite(settings, 'height', 'scene.contactShadow', { minimum: 0 });
  optionalFinite(settings, 'minimumRadius', 'scene.contactShadow', { minimum: 0 });
}

function validateLightPools(scene) {
  const settings = optionalObject(scene, 'lightPools', 'scene');
  if (!settings) return;

  optionalBoolean(settings, 'enabled', 'scene.lightPools');
  optionalPositive(settings, 'cellSize', 'scene.lightPools');
  optionalFinite(settings, 'amplitude', 'scene.lightPools', { minimum: 0 });
  optionalFinite(settings, 'warmth', 'scene.lightPools', {
    minimum: 0,
    maximum: 1,
  });
  optionalSeed(settings, 'seed', 'scene.lightPools');
}

function validateMeadow(scene) {
  const settings = optionalObject(scene, 'meadow', 'scene');
  if (!settings) return;

  optionalBoolean(settings, 'enabled', 'scene.meadow');
  const count = optionalFinite(settings, 'count', 'scene.meadow', { minimum: 0 });
  if (count !== undefined && !Number.isSafeInteger(count)) {
    throw new Error("Scene configuration 'scene.meadow.count' must be an integer.");
  }
  optionalFinite(settings, 'radius', 'scene.meadow', { minimum: 0 });
  optionalSeed(settings, 'seed', 'scene.meadow');
  optionalFinite(settings, 'flowerShare', 'scene.meadow', {
    minimum: 0,
    maximum: 1,
  });
  optionalColorList(settings, 'grassColors', 'scene.meadow');
  optionalColorList(settings, 'flowerColors', 'scene.meadow');

  if (settings.scale !== undefined) {
    const scale = settings.scale;
    if (
      !Array.isArray(scale) ||
      scale.length !== 2 ||
      scale.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value <= 0) ||
      scale[1] < scale[0]
    ) {
      throw new Error(
        "Scene configuration 'scene.meadow.scale' must contain two positive ascending numbers.",
      );
    }
  }
}

function validateDepthOfField(renderer) {
  const settings = optionalObject(renderer, 'depthOfField', 'renderer');
  if (!settings) return;

  optionalBoolean(settings, 'enabled', 'renderer.depthOfField');
  optionalFinite(settings, 'focusRange', 'renderer.depthOfField', { minimum: 0 });
  optionalPositive(settings, 'nearFalloff', 'renderer.depthOfField');
  optionalPositive(settings, 'farFalloff', 'renderer.depthOfField');
  optionalFinite(settings, 'blurRadius', 'renderer.depthOfField', { minimum: 0 });
  optionalFinite(settings, 'minimumFocus', 'renderer.depthOfField', { minimum: 0 });
  optionalFinite(settings, 'maximumFocus', 'renderer.depthOfField', { minimum: 0 });
  optionalFinite(settings, 'walkFocus', 'renderer.depthOfField', { minimum: 0 });

  if (
    settings.minimumFocus !== undefined &&
    settings.maximumFocus !== undefined &&
    settings.maximumFocus < settings.minimumFocus
  ) {
    throw new Error(
      "Scene configuration 'renderer.depthOfField.maximumFocus' must be >= 'renderer.depthOfField.minimumFocus'.",
    );
  }
}

function validateLightingOptions(lighting) {
  if (lighting.shadowExtent !== undefined) {
    optionalPositive(lighting, 'shadowExtent', 'lighting');
  }
  optionalBoolean(lighting, 'followFocus', 'lighting');
}

export function validateSceneRenderingOptions(config) {
  validateContactShadow(config.scene);
  validateLightPools(config.scene);
  validateMeadow(config.scene);
  validateDepthOfField(config.renderer);
  validateLightingOptions(config.lighting);
}
