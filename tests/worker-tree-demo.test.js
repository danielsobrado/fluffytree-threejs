import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkerTreeDemo } from '../src/app/worker-tree-demo.js';

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createDemo(workerTreeGenerationService) {
  const primeCalls = [];
  const demo = new WorkerTreeDemo({
    workerTreeGenerationService,
    treeIrAdapter: (treeData) => treeData,
    sceneFactory: {},
    treeGenerator: {
      prime(preset, seed, options, treeData) {
        primeCalls.push({ preset, seed, options, treeData });
      },
      generate() {
        throw new Error('Synchronous generation must not run before queue build.');
      },
    },
    treeMeshBuilder: {},
    windController: {
      clear() {},
      register() {},
    },
    renderSmokeProbe: { enabled: false },
    canopySolidityProbe: { enabled: false },
  });

  const added = [];
  demo.destroyed = false;
  demo.stressMode = false;
  demo.workerBuildRevision = 1;
  demo.sceneConfig = {
    layout: [
      {
        preset: 'oak',
        seed: 17,
        position: [0, 0, 0],
        rotationY: 0,
      },
    ],
  };
  demo.presetMap = new Map([['oak', { id: 'oak' }]]);
  demo.billboardBatchManager = { clear() {} };
  demo.lodController = {
    clear() {},
    register() {},
  };
  demo.contactShadows = { reset() {} };
  demo.context = {
    scene: {
      add(root) {
        added.push(root);
      },
      remove() {},
    },
    renderer: { shadowMap: { needsUpdate: false } },
  };
  demo.dressTree = () => {};

  return { demo, primeCalls, added };
}

test('queued scenes generate Tree IR off-thread before scheduling mesh work', async () => {
  const deferred = createDeferred();
  const requests = [];
  const service = {
    generate(preset, seed, options) {
      requests.push({ preset, seed, options });
      return deferred.promise;
    },
    cancelAll() {
      return 0;
    },
    destroy() {},
  };
  const { demo, primeCalls, added } = createDemo(service);
  let buildCalls = 0;
  demo.buildTreeEntry = () => {
    buildCalls += 1;
    return {
      root: { id: 'root' },
      treeData: { seed: 17 },
    };
  };

  demo.rebuildQueuedTrees();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].seed, 17);
  assert.deepEqual(requests[0].options.generationOptions, {
    includeSurfaceSamples: true,
  });
  assert.equal(demo.pendingWorkerBuilds, 1);
  assert.equal(demo.generationQueue.length, 0);
  assert.equal(buildCalls, 0);

  deferred.resolve({ presetId: 'oak', seed: 17 });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(primeCalls.length, 1);
  assert.equal(demo.pendingWorkerBuilds, 0);
  assert.equal(demo.generationQueue.length, 1);
  assert.equal(buildCalls, 0);

  demo.generationQueue.process(8);

  assert.equal(buildCalls, 1);
  assert.equal(added.length, 1);
  assert.equal(demo.treeRoots.length, 1);
  demo.destroyed = true;
});

test('stale worker results cannot repopulate a replaced scene', async () => {
  const deferred = createDeferred();
  const service = {
    generate() {
      return deferred.promise;
    },
    cancelAll() {
      return 0;
    },
    destroy() {},
  };
  const { demo, primeCalls } = createDemo(service);

  demo.rebuildQueuedTrees();
  demo.workerBuildRevision += 1;
  demo.pendingWorkerBuilds = 0;
  deferred.resolve({ presetId: 'oak', seed: 17 });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(primeCalls.length, 0);
  assert.equal(demo.generationQueue.length, 0);
  demo.destroyed = true;
});
