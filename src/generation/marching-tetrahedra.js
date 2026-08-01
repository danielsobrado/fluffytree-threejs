const CUBE_CORNERS = Object.freeze([
  Object.freeze([0, 0, 0]),
  Object.freeze([1, 0, 0]),
  Object.freeze([1, 1, 0]),
  Object.freeze([0, 1, 0]),
  Object.freeze([0, 0, 1]),
  Object.freeze([1, 0, 1]),
  Object.freeze([1, 1, 1]),
  Object.freeze([0, 1, 1]),
]);

const CUBE_TETRAHEDRA = Object.freeze([
  Object.freeze([0, 5, 1, 6]),
  Object.freeze([0, 1, 2, 6]),
  Object.freeze([0, 2, 3, 6]),
  Object.freeze([0, 3, 7, 6]),
  Object.freeze([0, 7, 4, 6]),
  Object.freeze([0, 4, 5, 6]),
]);

const MINIMUM_AXIS_SAMPLES = 10;
const POSITION_KEY_PRECISION = 6;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function interpolate(left, right, leftValue, rightValue) {
  const denominator = leftValue - rightValue;
  const ratio =
    Math.abs(denominator) <= Number.EPSILON
      ? 0.5
      : clamp(leftValue / denominator, 0, 1);

  return {
    x: left.x + (right.x - left.x) * ratio,
    y: left.y + (right.y - left.y) * ratio,
    z: left.z + (right.z - left.z) * ratio,
  };
}

function subtract(left, right) {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z,
  };
}

function cross(left, right) {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function midpoint(first, second, third) {
  return {
    x: (first.x + second.x + third.x) / 3,
    y: (first.y + second.y + third.y) / 3,
    z: (first.z + second.z + third.z) / 3,
  };
}

function createGrid(bounds, maximumResolution) {
  const extent = {
    x: bounds.maximum.x - bounds.minimum.x,
    y: bounds.maximum.y - bounds.minimum.y,
    z: bounds.maximum.z - bounds.minimum.z,
  };
  const maximumExtent = Math.max(extent.x, extent.y, extent.z);
  const cellSize = maximumExtent / Math.max(2, maximumResolution - 1);
  const counts = {
    x: Math.max(MINIMUM_AXIS_SAMPLES, Math.ceil(extent.x / cellSize) + 1),
    y: Math.max(MINIMUM_AXIS_SAMPLES, Math.ceil(extent.y / cellSize) + 1),
    z: Math.max(MINIMUM_AXIS_SAMPLES, Math.ceil(extent.z / cellSize) + 1),
  };
  const steps = {
    x: extent.x / (counts.x - 1),
    y: extent.y / (counts.y - 1),
    z: extent.z / (counts.z - 1),
  };

  return { counts, steps, cellSize };
}

function indexOf(x, y, z, counts) {
  return x + counts.x * (y + counts.y * z);
}

function pointAt(x, y, z, bounds, steps) {
  return {
    x: bounds.minimum.x + x * steps.x,
    y: bounds.minimum.y + y * steps.y,
    z: bounds.minimum.z + z * steps.z,
  };
}

function createNormalCache(field) {
  const cache = new Map();

  return (point) => {
    const key = `${point.x.toFixed(POSITION_KEY_PRECISION)}:${point.y.toFixed(POSITION_KEY_PRECISION)}:${point.z.toFixed(POSITION_KEY_PRECISION)}`;
    let normal = cache.get(key);

    if (!normal) {
      normal = field.gradient(point);
      cache.set(key, normal);
    }

    return normal;
  };
}

function appendTriangle(output, field, getNormal, first, second, third) {
  const center = midpoint(first, second, third);
  const faceNormal = cross(subtract(second, first), subtract(third, first));
  const outward = field.gradient(center);
  const ordered =
    dot(faceNormal, outward) >= 0
      ? [first, second, third]
      : [first, third, second];

  for (const point of ordered) {
    const normal = getNormal(point);
    output.positions.push(point.x, point.y, point.z);
    output.normals.push(normal.x, normal.y, normal.z);
  }

  output.triangleCount += 1;
}

function polygonizeTetrahedron(output, field, getNormal, points, values) {
  const inside = [];
  const outside = [];

  for (let index = 0; index < 4; index += 1) {
    (values[index] <= 0 ? inside : outside).push(index);
  }

  if (inside.length === 0 || inside.length === 4) return;

  if (inside.length === 1 || inside.length === 3) {
    const source = inside.length === 1 ? inside[0] : outside[0];
    const targets = inside.length === 1 ? outside : inside;
    const intersections = targets.map((target) =>
      interpolate(points[source], points[target], values[source], values[target]),
    );

    appendTriangle(
      output,
      field,
      getNormal,
      intersections[0],
      intersections[1],
      intersections[2],
    );
    return;
  }

  const [insideA, insideB] = inside;
  const [outsideA, outsideB] = outside;
  const a0 = interpolate(
    points[insideA],
    points[outsideA],
    values[insideA],
    values[outsideA],
  );
  const a1 = interpolate(
    points[insideA],
    points[outsideB],
    values[insideA],
    values[outsideB],
  );
  const b0 = interpolate(
    points[insideB],
    points[outsideA],
    values[insideB],
    values[outsideA],
  );
  const b1 = interpolate(
    points[insideB],
    points[outsideB],
    values[insideB],
    values[outsideB],
  );

  appendTriangle(output, field, getNormal, a0, b0, b1);
  appendTriangle(output, field, getNormal, a0, b1, a1);
}

export function extractIsoSurface(field, maximumResolution) {
  const grid = createGrid(field.bounds, maximumResolution);
  const { counts, steps } = grid;
  const values = new Float32Array(counts.x * counts.y * counts.z);

  for (let z = 0; z < counts.z; z += 1) {
    for (let y = 0; y < counts.y; y += 1) {
      for (let x = 0; x < counts.x; x += 1) {
        values[indexOf(x, y, z, counts)] = field.sample(
          pointAt(x, y, z, field.bounds, steps),
        );
      }
    }
  }

  const output = { positions: [], normals: [], triangleCount: 0 };
  const getNormal = createNormalCache(field);

  for (let z = 0; z < counts.z - 1; z += 1) {
    for (let y = 0; y < counts.y - 1; y += 1) {
      for (let x = 0; x < counts.x - 1; x += 1) {
        const points = CUBE_CORNERS.map(([dx, dy, dz]) =>
          pointAt(x + dx, y + dy, z + dz, field.bounds, steps),
        );
        const cubeValues = CUBE_CORNERS.map(([dx, dy, dz]) =>
          values[indexOf(x + dx, y + dy, z + dz, counts)],
        );

        for (const tetrahedron of CUBE_TETRAHEDRA) {
          polygonizeTetrahedron(
            output,
            field,
            getNormal,
            tetrahedron.map((index) => points[index]),
            tetrahedron.map((index) => cubeValues[index]),
          );
        }
      }
    }
  }

  return Object.freeze({
    positions: Float32Array.from(output.positions),
    normals: Float32Array.from(output.normals),
    triangleCount: output.triangleCount,
    vertexCount: output.positions.length / 3,
    grid: Object.freeze({
      counts: Object.freeze(counts),
      steps: Object.freeze(steps),
      cellSize: grid.cellSize,
    }),
    bounds: field.bounds,
  });
}
