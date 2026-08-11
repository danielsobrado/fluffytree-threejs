import assert from 'node:assert/strict';
import test from 'node:test';
import {
  postQaReport,
  reportQaStatus,
} from '../src/diagnostics/qa-status-reporter.js';

function withLocation(search, callback) {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { search },
  });

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      if (previousLocation) {
        Object.defineProperty(globalThis, 'location', previousLocation);
      } else {
        delete globalThis.location;
      }
    });
}

test('QA status endpoints are not called on a normal page', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    return { ok: true };
  };

  try {
    await withLocation('', async () => {
      reportQaStatus('error', 'boom');
      await postQaReport('report', { passed: false });
    });
    assert.equal(calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('QA status endpoints are called when a QA mode is active', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    return { ok: true, status: 204, statusText: 'No Content' };
  };

  try {
    await withLocation('?qa=render-smoke', async () => {
      reportQaStatus('ready');
      await postQaReport('report', { passed: true });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.equal(calls.length, 2);
    assert.match(String(calls[0][0]), /__render-smoke-status/);
    assert.match(String(calls[1][0]), /__qa-report/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('QA report network failures propagate to the gate', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('offline');
  };

  try {
    await withLocation('?qa=solidity', async () => {
      await assert.rejects(
        () => postQaReport('canopy-solidity', { passed: true }),
        /offline/,
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('QA report HTTP failures propagate to the gate', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 413,
    statusText: 'Payload Too Large',
  });

  try {
    await withLocation('?qa=solidity', async () => {
      await assert.rejects(
        () => postQaReport('canopy-solidity', { passed: true }),
        /413 Payload Too Large/,
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
