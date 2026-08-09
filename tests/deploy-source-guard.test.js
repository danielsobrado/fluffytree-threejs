import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALLOW_UNVERIFIED_SOURCE_FLAG,
  assertVerifiedDeploySource,
  parseDeployOptions,
} from '../tools/deploy-source-guard.js';

test('verified deployment is the default', () => {
  assert.deepEqual(parseDeployOptions(), { requireVerifiedSource: true });
  assert.deepEqual(parseDeployOptions([ALLOW_UNVERIFIED_SOURCE_FLAG]), {
    requireVerifiedSource: false,
  });
});

test('unknown deployment options fail fast', () => {
  assert.throws(() => parseDeployOptions(['--typo']), /Unknown deployment option/);
});

test('verified deployment requires a clean checkout at the fetched source', () => {
  assert.doesNotThrow(() =>
    assertVerifiedDeploySource({
      sourceSha: 'abc123',
      headSha: 'abc123',
      workingTreeStatus: '',
    }),
  );

  assert.throws(
    () =>
      assertVerifiedDeploySource({
        sourceSha: 'abc123',
        headSha: 'abc123',
        workingTreeStatus: ' M src/main.js',
      }),
    /clean working tree/,
  );

  assert.throws(
    () =>
      assertVerifiedDeploySource({
        sourceSha: 'abc123',
        headSha: 'def456',
        workingTreeStatus: '',
      }),
    /to match fetched source/,
  );
});
