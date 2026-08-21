import { TREE_ANIMATION_MODE_IDS } from './tree-animation-mode.js?v=2.0.0-20260814.2';
import { TREE_REPRESENTATION_ROLES } from '../rendering/tree-representation-role.js?v=2.0.0-20260814.2';

const REQUIRED_ROLES = Object.freeze([
  TREE_REPRESENTATION_ROLES.HERO,
  TREE_REPRESENTATION_ROLES.NEAR,
  TREE_REPRESENTATION_ROLES.AGGREGATE,
  TREE_REPRESENTATION_ROLES.IMPOSTOR,
  TREE_REPRESENTATION_ROLES.CULLED,
]);

function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value;
}

function requireNonNegativeInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${path} must be a non-negative integer.`);
  }
  return value;
}

function requireStemOrder(value, path) {
  if (value === null) return null;
  return requireNonNegativeInteger(value, path);
}

function requireBoolean(value, path) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${path} must be a boolean.`);
  }
  return value;
}

function parseRolePolicy(source, path) {
  requireObject(source, path);
  if (!TREE_ANIMATION_MODE_IDS.includes(source.mode)) {
    throw new Error(`${path}.mode is not a supported animation mode.`);
  }
  return Object.freeze({
    mode: source.mode,
    maximumStemOrder: requireStemOrder(
      source.maximumStemOrder,
      `${path}.maximumStemOrder`,
    ),
    includeFoliageNodes: requireBoolean(
      source.includeFoliageNodes,
      `${path}.includeFoliageNodes`,
    ),
  });
}

export function parseTreeAnimationPolicy(config) {
  const source = requireObject(config?.animation, 'treeAnimationPolicy.animation');
  const roles = requireObject(source.roles, 'treeAnimationPolicy.animation.roles');
  const parsedRoles = {};
  for (const role of REQUIRED_ROLES) {
    if (roles[role] === undefined) {
      throw new Error(`Missing tree animation role policy '${role}'.`);
    }
    parsedRoles[role] = parseRolePolicy(
      roles[role],
      `treeAnimationPolicy.animation.roles.${role}`,
    );
  }

  return Object.freeze({
    maximumHierarchicalTrees: requireNonNegativeInteger(
      source.maximumHierarchicalTrees,
      'treeAnimationPolicy.animation.maximumHierarchicalTrees',
    ),
    maximumReducedTrees: requireNonNegativeInteger(
      source.maximumReducedTrees,
      'treeAnimationPolicy.animation.maximumReducedTrees',
    ),
    roles: Object.freeze(parsedRoles),
  });
}
