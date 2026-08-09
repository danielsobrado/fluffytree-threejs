import assert from 'node:assert/strict';
import test from 'node:test';
import { YamlConfigLoader } from '../src/config/yaml-config-loader.js';

function response(body, { ok = true, status = 200, statusText = 'OK' } = {}) {
  return {
    ok,
    status,
    statusText,
    async text() {
      return body;
    },
  };
}

test('YAML config loader returns parsed configuration objects', async () => {
  const loader = new YamlConfigLoader({
    fetchImpl: async () => response('value: 42\n'),
  });

  assert.deepEqual(await loader.load('./config/test.yaml'), { value: 42 });
});

test('YAML config loader reports HTTP failures with the source URL', async () => {
  const loader = new YamlConfigLoader({
    fetchImpl: async () => response('', {
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }),
  });

  await assert.rejects(
    loader.load('./config/missing.yaml'),
    /missing\.yaml.*404 Not Found/,
  );
});

test('YAML config loader reports network failures with the source URL', async () => {
  const cause = new Error('offline');
  const loader = new YamlConfigLoader({
    fetchImpl: async () => {
      throw cause;
    },
  });

  await assert.rejects(loader.load('./config/network.yaml'), (error) => {
    assert.match(error.message, /network\.yaml/);
    assert.equal(error.cause, cause);
    return true;
  });
});

test('YAML config loader reports body read failures with the source URL', async () => {
  const cause = new Error('connection reset');
  const loader = new YamlConfigLoader({
    fetchImpl: async () => ({
      ok: true,
      async text() {
        throw cause;
      },
    }),
  });

  await assert.rejects(loader.load('./config/truncated.yaml'), (error) => {
    assert.match(error.message, /truncated\.yaml/);
    assert.equal(error.cause, cause);
    return true;
  });
});

test('YAML config loader reports parse failures with the source URL', async () => {
  const loader = new YamlConfigLoader({
    fetchImpl: async () => response('value: [\n'),
  });

  await assert.rejects(loader.load('./config/bad.yaml'), (error) => {
    assert.match(error.message, /bad\.yaml/);
    assert.ok(error.cause instanceof Error);
    return true;
  });
});

test('YAML config loader rejects arrays at the document root', async () => {
  const loader = new YamlConfigLoader({
    fetchImpl: async () => response('- first\n- second\n'),
  });

  await assert.rejects(
    loader.load('./config/list.yaml'),
    /did not contain an object/,
  );
});
