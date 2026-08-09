import { rotateVectorEuler } from '../generation/lobe-geometry.js';

const MINIMUM_DETERMINANT = 1e-12;

function projectedBasis(lobe) {
  return [
    rotateVectorEuler(
      { x: lobe.scale.x, y: 0, z: 0 },
      lobe.rotation,
    ),
    rotateVectorEuler(
      { x: 0, y: lobe.scale.y, z: 0 },
      lobe.rotation,
    ),
    rotateVectorEuler(
      { x: 0, y: 0, z: lobe.scale.z },
      lobe.rotation,
    ),
  ];
}

export function createLobeProjection(lobe, horizontalAxis) {
  if (horizontalAxis !== 'x' && horizontalAxis !== 'z') {
    throw new RangeError(`Unsupported lobe projection axis '${horizontalAxis}'.`);
  }

  const basis = projectedBasis(lobe);
  const xx = basis.reduce(
    (total, value) => total + value[horizontalAxis] ** 2,
    0,
  );
  const xy = basis.reduce(
    (total, value) => total + value[horizontalAxis] * value.y,
    0,
  );
  const yy = basis.reduce((total, value) => total + value.y ** 2, 0);
  const determinant = Math.max(MINIMUM_DETERMINANT, xx * yy - xy * xy);

  return {
    centerX: lobe.position[horizontalAxis],
    centerY: lobe.position.y,
    horizontalExtent: Math.sqrt(xx),
    verticalExtent: Math.sqrt(yy),
    xx,
    xy,
    yy,
    determinant,
  };
}

export function projectedLobeRow(projection, worldY) {
  const offsetY = worldY - projection.centerY;
  if (Math.abs(offsetY) > projection.verticalExtent) return null;

  const centerX =
    projection.centerX + (projection.xy / projection.yy) * offsetY;
  const remaining = Math.max(
    0,
    1 - (offsetY * offsetY) / projection.yy,
  );
  const halfWidth = Math.sqrt(
    (projection.determinant / projection.yy) * remaining,
  );

  return {
    minimum: centerX - halfWidth,
    maximum: centerX + halfWidth,
  };
}

export function projectedLobeContains(projection, worldX, worldY) {
  const x = worldX - projection.centerX;
  const y = worldY - projection.centerY;
  const normalized =
    (projection.yy * x * x -
      2 * projection.xy * x * y +
      projection.xx * y * y) /
    projection.determinant;
  return normalized <= 1;
}
