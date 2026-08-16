export const TREE_REPRESENTATION_ROLES = Object.freeze({
  HERO: 'hero',
  NEAR: 'near',
  AGGREGATE: 'aggregate',
  IMPOSTOR: 'impostor',
  CULLED: 'culled',
});

export const TREE_RENDER_REPRESENTATION_ROLES = Object.freeze([
  TREE_REPRESENTATION_ROLES.HERO,
  TREE_REPRESENTATION_ROLES.NEAR,
  TREE_REPRESENTATION_ROLES.AGGREGATE,
  TREE_REPRESENTATION_ROLES.IMPOSTOR,
]);

export function treeRepresentationRoleAt(index) {
  if (!Number.isSafeInteger(index) || index < 0) return null;
  return TREE_RENDER_REPRESENTATION_ROLES[index] ?? null;
}

export function treeRepresentationIndex(role) {
  return TREE_RENDER_REPRESENTATION_ROLES.indexOf(role);
}

export function isImpostorRepresentation(role) {
  return role === TREE_REPRESENTATION_ROLES.IMPOSTOR;
}

export function isDetailedTreeRepresentation(role) {
  return (
    role === TREE_REPRESENTATION_ROLES.HERO ||
    role === TREE_REPRESENTATION_ROLES.NEAR
  );
}
