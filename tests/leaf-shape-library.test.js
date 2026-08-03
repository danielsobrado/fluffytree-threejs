import assert from 'node:assert/strict';
import test from 'node:test';
import { FOLIAGE_ALPHA_SHAPES } from '../src/rendering/foliage-rendering-constants.js';
import {
  DEFAULT_LEAF_SHAPE_ID,
  getLeafShape,
  isLeafShapeId,
  LEAF_SHAPE_IDS,
  LEAF_SHAPE_OPTIONS,
  sampleLeafAlpha,
} from '../src/rendering/leaf-shape-library.js';

const RESOLUTION = 64;
const ALPHA_TEST = 0.46;

function measureCoverage(id) {
  const shape = getLeafShape(id);
  let covered = 0;

  for (let y = 0; y < RESOLUTION; y += 1) {
    for (let x = 0; x < RESOLUTION; x += 1) {
      const alpha = sampleLeafAlpha(
        (x + 0.5) / RESOLUTION - 0.5,
        (y + 0.5) / RESOLUTION - 0.5,
        shape,
      );
      if (alpha >= ALPHA_TEST) covered += 1;
    }
  }

  return covered / (RESOLUTION * RESOLUTION);
}

test('the default leaf shape is the historic broadleaf spray', () => {
  assert.equal(DEFAULT_LEAF_SHAPE_ID, 'broadleaf');
  assert.equal(getLeafShape().blades, FOLIAGE_ALPHA_SHAPES);
  assert.deepEqual(getLeafShape('broadleaf').softness, [0.72, 1.03]);
});

test('the historic broadleaf alpha is reproduced texel for texel', () => {
  const shape = getLeafShape('broadleaf');
  const smoothstep = (edge0, edge1, value) => {
    const normalized = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return normalized * normalized * (3 - 2 * normalized);
  };
  // The expression the alpha texture used before leaf shapes existed.
  const historic = (x, y) => {
    let alpha = 0;
    for (const blade of FOLIAGE_ALPHA_SHAPES) {
      const cos = Math.cos(blade.angle);
      const sin = Math.sin(blade.angle);
      const offsetX = x - blade.x;
      const offsetY = y - blade.y;
      const localX = offsetX * cos + offsetY * sin;
      const localY = -offsetX * sin + offsetY * cos;
      const longitudinal = localY / blade.radiusY;
      const envelope = Math.max(0.08, 1 - Math.abs(longitudinal) ** 1.65);
      const lateral = localX / (blade.radiusX * Math.sqrt(envelope));
      alpha = Math.max(
        alpha,
        1 - smoothstep(0.72, 1.03, lateral ** 2 + longitudinal ** 2),
      );
    }
    const spine =
      (1 - smoothstep(0.04, 0.15, Math.abs(x))) *
      (1 - smoothstep(0.45, 0.51, Math.abs(y)));
    return Math.min(1, Math.max(0, Math.max(alpha, spine * 0.92)));
  };

  for (let y = 0; y < RESOLUTION; y += 1) {
    for (let x = 0; x < RESOLUTION; x += 1) {
      const u = (x + 0.5) / RESOLUTION - 0.5;
      const v = (y + 0.5) / RESOLUTION - 0.5;
      assert.equal(sampleLeafAlpha(u, v, shape), historic(u, v));
    }
  }
});

// The shipped broadleaf spray cuts to 42.8% of its card. A shape far below that
// puts less alpha on the same crown surface, which is how a leaf choice turns
// into sky showing through the canopy.
test('every leaf shape carries enough alpha to read as foliage rather than a comb', () => {
  for (const id of LEAF_SHAPE_IDS) {
    const coverage = measureCoverage(id);
    assert.ok(
      coverage > 0.3,
      `leaf shape '${id}' only covers ${(coverage * 100).toFixed(1)}% of its card`,
    );
    assert.ok(
      coverage < 0.92,
      `leaf shape '${id}' covers ${(coverage * 100).toFixed(1)}% and has no silhouette`,
    );
  }
});

test('every blade stays inside the card it is rendered on', () => {
  for (const id of LEAF_SHAPE_IDS) {
    const shape = getLeafShape(id);
    assert.ok(shape.blades.length > 0);

    for (const blade of shape.blades) {
      const reach = Math.max(blade.radiusX, blade.radiusY);
      assert.ok(
        Math.abs(blade.x) + reach < 0.85 && Math.abs(blade.y) + reach < 0.85,
        `leaf shape '${id}' has a blade reaching past the card edge`,
      );
    }
  }
});

test('leaf shape lookups are validated', () => {
  assert.throws(() => getLeafShape('fern'), /Unsupported leaf shape/);
  assert.equal(isLeafShapeId('needle'), true);
  assert.equal(isLeafShapeId('constructor'), false);
  assert.equal(LEAF_SHAPE_OPTIONS.length, LEAF_SHAPE_IDS.length);
  assert.ok(LEAF_SHAPE_OPTIONS.every((option) => option.label.length > 0));
});
