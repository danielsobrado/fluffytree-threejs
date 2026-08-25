export function createTreeGenerationWorkerUrl(moduleUrl = import.meta.url) {
  const baseUrl = new URL(moduleUrl);
  const workerUrl = new URL('./tree-generation-worker.js', baseUrl);
  workerUrl.search = baseUrl.search;
  return workerUrl;
}

export function createTreeGenerationWorker() {
  return new Worker(createTreeGenerationWorkerUrl(), {
    type: 'module',
  });
}
