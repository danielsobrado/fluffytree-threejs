import assert from 'node:assert/strict';
import test from 'node:test';
import { createGoldenAngleDiskKernel } from '../src/rendering/depth-of-field-kernel.js';

test('depth-of-field kernel preserves the golden-angle disk samples', () => {
  const kernel = createGoldenAngleDiskKernel(16);
  assert.equal(kernel.length, 16);
  assert.ok(Math.abs(kernel[0][0] - Math.sqrt(0.5 / 16)) < 1e-12);
  assert.ok(Math.abs(kernel[0][1]) < 1e-12);

  for (const [x, y] of kernel) {
    assert.ok(x * x + y * y < 1);
  }
  assert.deepEqual(kernel, createGoldenAngleDiskKernel(16));
});

test('depth-of-field kernel rejects invalid tap counts', () => {
  for (const count of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => createGoldenAngleDiskKernel(count), /positive integer/);
  }
});
