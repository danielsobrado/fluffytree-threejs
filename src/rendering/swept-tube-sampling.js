const AXES = Object.freeze([
  Object.freeze({ x: 1, y: 0, z: 0 }),
  Object.freeze({ x: 0, y: 1, z: 0 }),
  Object.freeze({ x: 0, y: 0, z: 1 }),
]);

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

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z);

  if (length <= 1e-9) return null;

  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function selectReferenceAxis(tangent) {
  const components = [Math.abs(tangent.x), Math.abs(tangent.y), Math.abs(tangent.z)];
  const smallest = components.indexOf(Math.min(...components));
  return AXES[smallest];
}

function createInitialNormal(tangent) {
  return normalize(cross(selectReferenceAxis(tangent), tangent));
}

function projectOntoPlane(vector, tangent) {
  const projection = dot(vector, tangent);
  return normalize({
    x: vector.x - tangent.x * projection,
    y: vector.y - tangent.y * projection,
    z: vector.z - tangent.z * projection,
  });
}

/**
 * Ring parameters biased towards the start of the curve so the flared root end
 * receives more rings than the smooth upper span.
 */
export function createSweepParameters(sampleCount, bias = 1) {
  const parameters = [];

  for (let index = 0; index <= sampleCount; index += 1) {
    const ratio = index / sampleCount;
    parameters.push(bias === 1 ? ratio : Math.pow(ratio, bias));
  }

  return parameters;
}

/**
 * Rotation-minimising frames. Each normal is the previous normal projected back
 * onto the plane of the current tangent, which keeps the ring seam from twisting
 * along the sweep.
 */
export function createSweepFrames(tangents) {
  if (!Array.isArray(tangents) || tangents.length < 2) {
    throw new Error('A swept tube requires at least two tangents.');
  }

  const normals = [];
  const binormals = [];
  let previous = null;

  for (const rawTangent of tangents) {
    const tangent = normalize(rawTangent);

    if (!tangent) {
      throw new Error('A swept tube tangent has zero length.');
    }

    const normal =
      (previous ? projectOntoPlane(previous, tangent) : null) ??
      createInitialNormal(tangent);
    normals.push(normal);
    binormals.push(cross(tangent, normal));
    previous = normal;
  }

  return { normals, binormals };
}
