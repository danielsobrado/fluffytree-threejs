import assert from 'node:assert/strict';
import test from 'node:test';
import { LobeConnectionAnalyzer } from '../src/generation/lobe-connection-analyzer.js';

function lobe(id, x, y, macroClumpId) {
  return {
    id,
    macroClumpId,
    position: { x, y, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
  };
}

test('lobe connection analysis records only overlapping rotated ellipsoids', () => {
  const connections = new LobeConnectionAnalyzer().analyze([
    lobe(0, 0, 0, 0),
    lobe(1, 1.8, 0, 0),
    lobe(2, 4.5, 0, 1),
  ]);

  assert.equal(connections.length, 1);
  assert.equal(connections[0].leftLobeId, 0);
  assert.equal(connections[0].rightLobeId, 1);
  assert.equal(connections[0].sameMacro, true);
  assert.ok(Math.abs(connections[0].overlapRatio - 0.9) < 1e-9);
  assert.equal(connections[0].verticalAlignment, 0);
});

test('lobe connection analysis measures vertical alignment for shape policy', () => {
  const [connection] = new LobeConnectionAnalyzer().analyze([
    lobe(0, 0, 0, 0),
    lobe(1, 0, 1.8, 1),
  ]);

  assert.equal(connection.sameMacro, false);
  assert.ok(Math.abs(connection.verticalAlignment - 1) < 1e-9);
  assert.deepEqual(connection.direction, { x: 0, y: 1, z: 0 });
});
