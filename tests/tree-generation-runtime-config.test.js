import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import yaml from 'js-yaml';
import { parseTreeGenerationRuntimePolicy } from '../src/workers/tree-generation-runtime-policy.js';

const CONFIG_URL = new URL('../config/tree-generation-runtime.yaml', import.meta.url);

test('tree generation runtime config is valid', () => {
  const config = yaml.load(readFileSync(CONFIG_URL, 'utf8'));
  const policy = parseTreeGenerationRuntimePolicy(config);

  assert.equal(policy.enabled, true);
  assert.ok(policy.maximumWorkers >= 1);
  assert.ok(policy.reserveLogicalCores >= 0);
  assert.equal(policy.terminateOnCancel, true);
  assert.ok(policy.maximumCachedResults >= 1);
});
