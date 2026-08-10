import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDeploySourceMatchesCheckout } from '../tools/deploy-source-guard.js';

test('deployment requires a clean checkout at the fetched source', () => {
  assert.doesNotThrow(() =>
    assertDeploySourceMatchesCheckout({
      sourceSha: 'abc123',
      headSha: 'abc123',
      workingTreeStatus: '',
    }),
  );

  assert.throws(
    () =>
      assertDeploySourceMatchesCheckout({
        sourceSha: 'abc123',
        headSha: 'abc123',
        workingTreeStatus: ' M src/main.js',
      }),
    /clean working tree/,
  );

  assert.throws(
    () =>
      assertDeploySourceMatchesCheckout({
        sourceSha: 'abc123',
        headSha: 'def456',
        workingTreeStatus: '',
      }),
    /to match fetched source/,
  );
});

test('deployment source identifiers must be present', () => {
  assert.throws(
    () =>
      assertDeploySourceMatchesCheckout({
        sourceSha: '',
        headSha: 'abc123',
        workingTreeStatus: '',
      }),
    /Remote source commit SHA cannot be empty/,
  );
  assert.throws(
    () =>
      assertDeploySourceMatchesCheckout({
        sourceSha: 'abc123',
        headSha: '',
        workingTreeStatus: '',
      }),
    /Local HEAD commit SHA cannot be empty/,
  );
});
