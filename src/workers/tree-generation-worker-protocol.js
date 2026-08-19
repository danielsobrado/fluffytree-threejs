import { assertCanonicalValue } from '../core/canonical-value-hash.js';

export const TREE_GENERATION_WORKER_MESSAGES = Object.freeze({
  GENERATE: 'tree-generation:generate',
  CANCEL: 'tree-generation:cancel',
  RESULT: 'tree-generation:result',
  ERROR: 'tree-generation:error',
});

export function createTreeGenerationRequest({
  requestId,
  key,
  revision,
  preset,
  seed,
  options = {},
}) {
  const request = {
    requestId,
    key,
    revision,
    preset,
    seed,
    options,
  };
  assertCanonicalValue(request, 'Tree generation request');
  return Object.freeze({
    requestId,
    key,
    revision,
    preset,
    seed,
    options: Object.freeze({ ...options }),
  });
}
