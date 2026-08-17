import { calculateTreeWindBoundsPadding } from './tree-wind-profile.js';

function expandInstancedBounds(object, additionalPadding) {
  if (!object.boundingBox) object.computeBoundingBox?.();
  if (!object.boundingSphere) object.computeBoundingSphere?.();
  object.boundingBox?.expandByScalar?.(additionalPadding);
  if (object.boundingSphere) object.boundingSphere.radius += additionalPadding;
}

function expandGeometryBounds(geometry, additionalPadding) {
  if (!geometry.boundingBox) geometry.computeBoundingBox?.();
  if (!geometry.boundingSphere) geometry.computeBoundingSphere?.();
  geometry.boundingBox?.expandByScalar?.(additionalPadding);
  if (geometry.boundingSphere) geometry.boundingSphere.radius += additionalPadding;
}

export function expandTreeWindBounds(object, strength) {
  if (!object) return false;
  const targetPadding = calculateTreeWindBoundsPadding(strength);
  const target = object.isInstancedMesh ? object : object.geometry;
  if (!target) return false;

  const userData = target.userData ?? (target.userData = {});
  const previousPadding = Number(userData.windBoundsPadding ?? 0);
  const additionalPadding = targetPadding - previousPadding;
  if (!(additionalPadding > Number.EPSILON)) return false;

  if (object.isInstancedMesh) {
    expandInstancedBounds(object, additionalPadding);
  } else {
    expandGeometryBounds(target, additionalPadding);
  }
  userData.windBoundsPadding = targetPadding;
  return true;
}
