import { TREE_GENERATION_WORKER_MESSAGES } from './tree-generation-worker-protocol.js?v=2.0.0-20260814.2';

function serializeError(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? 'Tree generation worker failed.',
    stack: typeof error?.stack === 'string' ? error.stack : undefined,
  };
}

export function installTreeGenerationWorker(scope, { treeGenerator } = {}) {
  if (!scope || typeof scope.addEventListener !== 'function') {
    throw new TypeError('Tree generation worker scope must provide addEventListener().');
  }
  if (!treeGenerator || typeof treeGenerator.generateIr !== 'function') {
    throw new TypeError('Tree generation worker requires a TreeGenerator.');
  }

  scope.addEventListener('message', (event) => {
    const message = event?.data;
    if (!message || message.type !== TREE_GENERATION_WORKER_MESSAGES.GENERATE) {
      return;
    }

    const request = message.request;
    try {
      const treeIr = treeGenerator.generateIr(
        request.preset,
        request.seed,
        request.options,
      );
      scope.postMessage({
        type: TREE_GENERATION_WORKER_MESSAGES.RESULT,
        requestId: request.requestId,
        key: request.key,
        revision: request.revision,
        treeIr,
      });
    } catch (error) {
      scope.postMessage({
        type: TREE_GENERATION_WORKER_MESSAGES.ERROR,
        requestId: request.requestId,
        key: request.key,
        revision: request.revision,
        error: serializeError(error),
      });
    }
  });
}
