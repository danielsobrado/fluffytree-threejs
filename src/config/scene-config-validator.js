import { SCENE_RUNTIME_CONSTANTS } from './scene-runtime-constants.js?v=2.0.0-20260814.2';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const MAXIMUM_SEED = 0xffffffff;

function requireObject(parent, key) {
  const value = parent?.[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Scene configuration '${key}' must be an object.`);
  }
  return value;
}

function requireString(parent, key, path) {
  const value = parent[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Scene configuration '${path}.${key}' must be a non-empty string.`);
  }
  return value;
}

function requireColor(parent, key, path) {
  const value = requireString(parent, key, path);
  if (!HEX_COLOR_PATTERN.test(value)) {
    throw new Error(`Scene configuration '${path}.${key}' must be a #RRGGBB color.`);
  }
  return value;
}

function requireFinite(parent, key, path, { minimum = null, maximum = null } = {}) {
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

function requirePositive(parent, key, path) {
  const value = requireFinite(parent, key, path);
  if (value <= 0) {
    throw new Error(`Scene configuration '${path}.${key}' must be > 0.`);
  }
  return value;
}

function requireVector(parent, key, path, size = 3) {
  const value = parent[key];
  if (
    !Array.isArray(value) ||
    value.length !== size ||
    value.some((item) => typeof item !== 'number' || !Number.isFinite(item))
  ) {
    throw new Error(`Scene configuration '${path}.${key}' must contain ${size} finite numbers.`);
  }
  return value;
}

function vectorLengthSquared(vector) {
  return vector.reduce((total, value) => total + value * value, 0);
}

function vectorsEqual(left, right) {
  return left.every((value, index) => value === right[index]);
}

function validateSceneSection(config) {
  const scene = requireObject(config, 'scene');
  requireColor(scene, 'backgroundColor', 'scene');
  requireColor(scene, 'fogColor', 'scene');
  const fogNear = requireFinite(scene, 'fogNear', 'scene', { minimum: 0 });
  const fogFar = requirePositive(scene, 'fogFar', 'scene');
  if (fogFar <= fogNear) {
    throw new Error("Scene configuration 'scene.fogFar' must be greater than 'scene.fogNear'.");
  }
  requireColor(scene, 'groundColor', 'scene');
  requirePositive(scene, 'groundSize', 'scene');
}

function validateCamera(config) {
  const camera = requireObject(config, 'camera');
  const fieldOfView = requirePositive(camera, 'fieldOfView', 'camera');
  if (fieldOfView >= 180) {
    throw new Error("Scene configuration 'camera.fieldOfView' must be < 180.");
  }
  const near = requirePositive(camera, 'near', 'camera');
  const far = requirePositive(camera, 'far', 'camera');
  if (far <= near) {
    throw new Error("Scene configuration 'camera.far' must be greater than 'camera.near'.");
  }
  const position = requireVector(camera, 'position', 'camera');
  const target = requireVector(camera, 'target', 'camera');
  if (vectorsEqual(position, target)) {
    throw new Error("Scene configuration 'camera.position' must differ from 'camera.target'.");
  }
  if (camera.controlsMaxDistance !== undefined) {
    requireFinite(camera, 'controlsMaxDistance', 'camera', {
      minimum: SCENE_RUNTIME_CONSTANTS.minimumOrbitDistance,
    });
  }
}

function validateRenderer(config) {
  const renderer = requireObject(config, 'renderer');
  requirePositive(renderer, 'maxPixelRatio', 'renderer');
  const shadowMapSize = requirePositive(renderer, 'shadowMapSize', 'renderer');
  if (!Number.isInteger(shadowMapSize)) {
    throw new Error("Scene configuration 'renderer.shadowMapSize' must be an integer.");
  }
}

function validateLod(config) {
  const lod = requireObject(config, 'lod');
  const nearPixels = requirePositive(lod, 'nearPixels', 'lod');
  const mediumPixels = requirePositive(lod, 'mediumPixels', 'lod');
  const farPixels = requirePositive(lod, 'farPixels', 'lod');
  const cullPixels = requirePositive(lod, 'cullPixels', 'lod');
  if (!(nearPixels > mediumPixels && mediumPixels > farPixels && farPixels > cullPixels)) {
    throw new Error(
      "Scene configuration LOD thresholds must satisfy nearPixels > mediumPixels > farPixels > cullPixels.",
    );
  }

  const hysteresis = requireFinite(lod, 'hysteresis', 'lod', { minimum: 0 });
  if (hysteresis >= 1) {
    throw new Error("Scene configuration 'lod.hysteresis' must be < 1.");
  }
  requireFinite(lod, 'fadeBand', 'lod', { minimum: 0, maximum: 1 });
  requirePositive(lod, 'shadowPixels', 'lod');
  requirePositive(lod, 'generationBudgetMs', 'lod');
}

function validateLighting(config) {
  const lighting = requireObject(config, 'lighting');
  requireColor(lighting, 'hemisphereSkyColor', 'lighting');
  requireColor(lighting, 'hemisphereGroundColor', 'lighting');
  requireFinite(lighting, 'hemisphereIntensity', 'lighting', { minimum: 0 });
  requireColor(lighting, 'sunColor', 'lighting');
  requireFinite(lighting, 'sunIntensity', 'lighting', { minimum: 0 });
  const sunPosition = requireVector(lighting, 'sunPosition', 'lighting');
  if (vectorLengthSquared(sunPosition) <= Number.EPSILON) {
    throw new Error("Scene configuration 'lighting.sunPosition' must not be the zero vector.");
  }
}

function validateLayout(config) {
  if (!Array.isArray(config.layout) || config.layout.length === 0) {
    throw new Error("Scene configuration 'layout' must contain at least one tree.");
  }

  config.layout.forEach((entry, index) => {
    const path = `layout[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Scene configuration '${path}' must be an object.`);
    }
    requireString(entry, 'preset', path);
    const seed = requireFinite(entry, 'seed', path, {
      minimum: 0,
      maximum: MAXIMUM_SEED,
    });
    if (!Number.isSafeInteger(seed)) {
      throw new Error(`Scene configuration '${path}.seed' must be an unsigned 32-bit integer.`);
    }
    requireVector(entry, 'position', path);
    if (entry.rotationY !== undefined) requireFinite(entry, 'rotationY', path);
  });
}

export function validateSceneConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Scene configuration must be an object.');
  }

  validateSceneSection(config);
  validateCamera(config);
  validateRenderer(config);
  validateLod(config);
  validateLighting(config);
  validateLayout(config);
  return config;
}
