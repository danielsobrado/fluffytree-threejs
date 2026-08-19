export function createTreeGenerationWorker() {
  return new Worker(new URL('./tree-generation-worker.js', import.meta.url), {
    type: 'module',
  });
}
