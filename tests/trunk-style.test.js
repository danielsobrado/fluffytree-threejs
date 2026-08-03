import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTrunkStyle,
  isTrunkStyleId,
  TRUNK_STYLE_IDS,
  TRUNK_STYLE_OPTIONS,
} from '../src/generation/trunk-style.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

const BASE_TRUNK = Object.freeze({
  bend: 0.6,
  movement: 1,
  curveCount: 2,
  sweep: 0.4,
  segments: 12,
});
const BONSAI_STYLE_IDS = TRUNK_STYLE_IDS.filter((id) => id !== 'natural');

test('every bonsai trunk style leaves the ground at the origin', () => {
  for (const id of BONSAI_STYLE_IDS) {
    const style = createTrunkStyle({ ...BASE_TRUNK, style: id });
    const base = style.displace(0);

    assert.ok(
      Math.abs(base.x) < 1e-12 && Math.abs(base.z) < 1e-12,
      `style '${id}' displaces its base by (${base.x}, ${base.z})`,
    );
  }
});

test('natural keeps the historic base offset the existing presets were tuned against', () => {
  const base = createTrunkStyle({ ...BASE_TRUNK, style: 'natural' }).displace(0);

  assert.equal(base.x, 0);
  assert.equal(base.z, -0.07 * BASE_TRUNK.bend);
});

test('every trunk style rises monotonically along the sweep', () => {
  for (const id of TRUNK_STYLE_IDS) {
    const style = createTrunkStyle({ ...BASE_TRUNK, style: id });

    assert.ok(style.heightPower > 0, `style '${id}' has a non-positive height power`);

    let previous = -1;
    for (let index = 0; index <= 16; index += 1) {
      const rise = Math.pow(index / 16, style.heightPower);
      assert.ok(rise > previous, `style '${id}' does not ascend at t=${index / 16}`);
      previous = rise;
    }
  }
});

test('the natural style reproduces the historic trunk displacement', () => {
  const style = createTrunkStyle({ bend: 0.34, style: 'natural' });

  for (let index = 0; index <= 8; index += 1) {
    const t = index / 8;
    const bend = Math.sin(t * Math.PI * 0.9) * 0.34;
    const offset = style.displace(t);

    assert.equal(offset.x, bend * 0.68 + Math.sin(t * Math.PI * 2.1) * 0.34 * 0.08);
    assert.equal(offset.z, bend * 0.24 - Math.cos(t * Math.PI * 1.7) * 0.34 * 0.07);
  }

  assert.equal(style.taperPower, 0.76);
  assert.equal(style.heightPower, 1);
});

test('natural leaves the crown where the preset put it and bonsai styles carry it', () => {
  const natural = createTrunkStyle({ ...BASE_TRUNK, style: 'natural' });

  assert.deepEqual(natural.crownAnchor, { x: 0, z: 0 });

  for (const id of TRUNK_STYLE_IDS.filter((entry) => entry !== 'natural')) {
    const style = createTrunkStyle({ ...BASE_TRUNK, style: id });
    const apex = style.displace(1);

    assert.ok(
      Math.abs(style.crownAnchor.x - apex.x) < 1e-12 &&
        Math.abs(style.crownAnchor.z - apex.z) < 1e-12,
      `style '${id}' anchors the crown away from its own apex`,
    );
  }
});

test('the leaning styles actually travel and the upright styles return over the base', () => {
  const reach = (id) => {
    const style = createTrunkStyle({ ...BASE_TRUNK, style: id });
    return Math.hypot(style.crownAnchor.x, style.crownAnchor.z);
  };

  for (const id of ['formalUpright', 'informalUpright']) {
    assert.ok(reach(id) < 1e-9, `style '${id}' does not finish over its own base`);
  }

  for (const id of ['slant', 'windswept', 'literati', 'semiCascade']) {
    assert.ok(reach(id) > BASE_TRUNK.bend, `style '${id}' barely leaves the vertical`);
  }
});

test('movement scales the displacement and taper is overridable per preset', () => {
  const single = createTrunkStyle({ ...BASE_TRUNK, style: 'informalUpright' });
  const double = createTrunkStyle({
    ...BASE_TRUNK,
    style: 'informalUpright',
    movement: 2,
  });

  assert.ok(Math.abs(double.displace(0.3).x - single.displace(0.3).x * 2) < 1e-12);
  assert.equal(
    createTrunkStyle({ ...BASE_TRUNK, style: 'slant', taperPower: 0.4 }).taperPower,
    0.4,
  );
});

/**
 * The swept trunk's first ring is perpendicular to the tangent and as wide as
 * the root flare, so a trunk that launches at an angle tips its own base out of
 * the ground. The ramp is what keeps that from happening, and it is invisible
 * in the style functions themselves.
 */
test('bonsai trunks leave the nebari close to vertical', () => {
  for (const segments of [4, 8, 12, 16]) {
    for (const style of BONSAI_STYLE_IDS) {
      const preset = createTestPreset({
        trunk: {
          style,
          segments,
          movement: 1.5,
          curveCount: 2.4,
          sweep: 0.8,
          bend: 0.9,
          branching: {
            depth: 3,
            primaryCount: 4,
            childCount: [1, 2],
            lengthDecay: 0.64,
            radiusDecay: 0.62,
            upwardBias: 0.66,
            gnarl: 0.9,
            twist: 0.6,
            exposedTipRatio: 0.16,
          },
        },
      });

      for (let seed = 1; seed <= 6; seed += 1) {
        const points = new TreeGenerator().generate(preset, seed, {
          includeSurfaceSamples: false,
        }).trunk.points;
        const rise = points[1].y - points[0].y;
        const travel = Math.hypot(
          points[1].x - points[0].x,
          points[1].z - points[0].z,
        );
        const degrees = (Math.atan2(travel, rise) * 180) / Math.PI;

        assert.ok(
          degrees < 20,
          `style '${style}' with ${segments} segments seed ${seed} leaves the ground at ${degrees.toFixed(1)} degrees`,
        );
      }
    }
  }
});

test('the ramp is fully open by the apex, so it cannot move the crown anchor', () => {
  for (const segments of [4, 8, 12, 16]) {
    for (const id of BONSAI_STYLE_IDS) {
      const style = createTrunkStyle({ ...BASE_TRUNK, style: id, segments });

      assert.equal(style.rampAt(1), 1);
      assert.equal(style.rampAt(0), 0);
      assert.deepEqual(style.crownAnchor, {
        x: style.displace(1).x,
        z: style.displace(1).z,
      });
    }
  }

  // The historic style is exempt: a flat ramp reproduces its trunk exactly.
  const natural = createTrunkStyle({ ...BASE_TRUNK, style: 'natural' });
  assert.equal(natural.rampAt(0), 1);
  assert.equal(natural.rampAt(0.5), 1);
});

test('an unknown trunk style is rejected', () => {
  assert.throws(() => createTrunkStyle({ bend: 0.4, style: 'bonsaiish' }), /Unsupported trunk style/);
  assert.equal(isTrunkStyleId('informalUpright'), true);
  assert.equal(isTrunkStyleId('toString'), false);
  assert.equal(TRUNK_STYLE_OPTIONS.length, TRUNK_STYLE_IDS.length);
});

test('a styled trunk stays ascending and starts at the tree origin when generated', () => {
  for (const style of BONSAI_STYLE_IDS) {
    const preset = createTestPreset({
      trunk: { style, movement: 1.2, curveCount: 2.4, sweep: 0.8, bend: 0.55 },
    });
    const tree = new TreeGenerator().generate(preset, 7, {
      includeSurfaceSamples: false,
    });
    const points = tree.trunk.points;

    assert.equal(points[0].x, 0);
    assert.equal(points[0].y, 0);
    assert.equal(points[0].z, 0);

    for (let index = 1; index < points.length; index += 1) {
      assert.ok(
        points[index].y > points[index - 1].y,
        `style '${style}' produced a non-ascending trunk segment`,
      );
    }
  }
});
