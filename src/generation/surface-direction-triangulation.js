import { normalizeVector } from './lobe-geometry.js?v=2.0.0-20260814.2';

const PHI = (1 + Math.sqrt(5)) / 2;

const ICOSAHEDRON_VERTICES = Object.freeze([
  [-1, PHI, 0],
  [1, PHI, 0],
  [-1, -PHI, 0],
  [1, -PHI, 0],
  [0, -1, PHI],
  [0, 1, PHI],
  [0, -1, -PHI],
  [0, 1, -PHI],
  [PHI, 0, -1],
  [PHI, 0, 1],
  [-PHI, 0, -1],
  [-PHI, 0, 1],
].map(([x, y, z]) => Object.freeze(normalizeVector({ x, y, z }))));

const ICOSAHEDRON_FACES = Object.freeze([
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
]);

function midpoint(left, right) {
  return normalizeVector({
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  });
}

function distance(left, right) {
  return Math.hypot(
    left.x - right.x,
    left.y - right.y,
    left.z - right.z,
  );
}

export function createIcosahedronDirectionTriangles() {
  return ICOSAHEDRON_FACES.map(([a, b, c]) => ({
    a: ICOSAHEDRON_VERTICES[a],
    b: ICOSAHEDRON_VERTICES[b],
    c: ICOSAHEDRON_VERTICES[c],
  }));
}

export function subdivideDirectionTriangle(triangle) {
  const ab = midpoint(triangle.a, triangle.b);
  const bc = midpoint(triangle.b, triangle.c);
  const ca = midpoint(triangle.c, triangle.a);

  return [
    { a: triangle.a, b: ab, c: ca },
    { a: ab, b: triangle.b, c: bc },
    { a: ca, b: bc, c: triangle.c },
    { a: ab, b: bc, c: ca },
  ];
}

export function directionTriangleCentroid(triangle) {
  return normalizeVector({
    x: triangle.a.x + triangle.b.x + triangle.c.x,
    y: triangle.a.y + triangle.b.y + triangle.c.y,
    z: triangle.a.z + triangle.b.z + triangle.c.z,
  });
}

export function directionTriangleDiameter(triangle) {
  return Math.max(
    distance(triangle.a, triangle.b),
    distance(triangle.b, triangle.c),
    distance(triangle.c, triangle.a),
  );
}
