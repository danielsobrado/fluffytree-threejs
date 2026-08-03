import assert from 'node:assert/strict';
import test from 'node:test';
import { createFoliageCoreLayout } from '../src/rendering/foliage-core-layout.js';

function continuity(overrides = {}) {
  return {
    bridgeRadiusRatio: 0.35,
    bridgeLengthPaddingRatio: 0.2,
    coreOverlapSafety: 0.86,
    sameMacroOnly: false,
    verticalBias: 0.3,
    lod: [
      { coreScale: 1, bridges: true },
      { coreScale: 1.08, bridges: true },
      { coreScale: 1.16, bridges: true },
    ],
    ...overrides,
  };
}

function lobe(id, x, macroClumpId) {
  return {
    id,
    macroClumpId,
    position: { x, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
    colorMix: id * 0.2,
  };
}

function tree(overrides = {}) {
  const lobes = [lobe(0, 0, 0), lobe(1, 1.88, 1)];
  return {
    crownProfile: 'columnar',
    continuity: continuity(),
    crownCenter: { x: 0.94, y: 0, z: 0 },
    palette: { core: { scale: 0.67 } },
    lobes,
    lobeExposure: [0.8, 0.6],
    lobeConnections: [
      {
        leftLobeId: 0,
        rightLobeId: 1,
        sameMacro: false,
        overlapRatio: 0.94,
        distance: 1.88,
        verticalAlignment: 0,
        direction: { x: 1, y: 0, z: 0 },
        leftRadius: 1,
        rightRadius: 1,
      },
    ],
    ...overrides,
  };
}

test('weak core overlap creates an opaque connector in the same draw layout', () => {
  const layout = createFoliageCoreLayout(tree(), {
    lodIndex: 0,
    scaleMultiplier: 1.35,
  });

  assert.equal(layout.lobeInstanceCount, 2);
  assert.equal(layout.bridgeInstanceCount, 1);
  assert.equal(layout.instances.length, 3);
  const bridge = layout.instances.at(-1);
  assert.equal(bridge.kind, 'bridge');
  assert.ok(bridge.scale.x > 0);
  assert.ok(bridge.scale.y >= bridge.scale.x);
  assert.equal(bridge.exposure, 0.6 * 0.35);
});

test('already connected cores do not receive redundant bridge geometry', () => {
  const source = tree();
  source.lobeConnections[0] = {
    ...source.lobeConnections[0],
    overlapRatio: 0.6,
    distance: 1.2,
  };

  const layout = createFoliageCoreLayout(source, {
    lodIndex: 0,
    scaleMultiplier: 1.35,
  });

  assert.equal(layout.bridgeInstanceCount, 0);
});

test('pad crowns preserve intentional gaps between different macro pads', () => {
  const source = tree({
    crownProfile: 'pad',
    continuity: continuity({ sameMacroOnly: true }),
  });
  const layout = createFoliageCoreLayout(source, {
    lodIndex: 0,
    scaleMultiplier: 1.35,
  });

  assert.equal(layout.bridgeInstanceCount, 0);
});

test('reduced LODs can strengthen core scale without changing lobe topology', () => {
  const near = createFoliageCoreLayout(tree(), {
    lodIndex: 0,
    scaleMultiplier: 1.35,
  });
  const far = createFoliageCoreLayout(tree(), {
    lodIndex: 2,
    scaleMultiplier: 1.35,
  });

  assert.ok(far.effectiveCoreScale > near.effectiveCoreScale);
  assert.equal(far.lobeInstanceCount, near.lobeInstanceCount);
});
