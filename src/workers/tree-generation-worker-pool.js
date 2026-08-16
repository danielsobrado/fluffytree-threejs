import { PrioritizedFrameBudgetQueue } from '../generation/prioritized-frame-budget-queue.js';
import { validateTreeIr } from '../generation/tree-ir-validator.js';
import { createTreeGenerationWorker } from './tree-generation-worker-factory.js';
import {
  createTreeGenerationRequest,
  TREE_GENERATION_WORKER_MESSAGES,
} from './tree-generation-worker-protocol.js';

class TreeGenerationCancelledError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AbortError';
  }
}

function restoreWorkerError(value) {
  const error = new Error(value?.message ?? 'Tree generation worker failed.');
  error.name = value?.name ?? 'Error';
  if (typeof value?.stack === 'string') error.stack = value.stack;
  return error;
}

function queueKey(key) {
  return `tree-generation:${key}`;
}

export class TreeGenerationWorkerPool {
  constructor({
    policy,
    workerFactory = createTreeGenerationWorker,
    queue = new PrioritizedFrameBudgetQueue(),
  }) {
    if (!policy || !Number.isSafeInteger(policy.maximumWorkers)) {
      throw new TypeError('TreeGenerationWorkerPool requires a worker policy.');
    }
    if (typeof workerFactory !== 'function') {
      throw new TypeError('Tree generation workerFactory must be a function.');
    }
    this.policy = policy;
    this.workerFactory = workerFactory;
    this.queue = queue;
    this.revisions = new Map();
    this.jobsByKey = new Map();
    this.completedCount = 0;
    this.cancelledCount = 0;
    this.failedCount = 0;
    this.destroyed = false;
    this.slots = Array.from(
      { length: policy.maximumWorkers },
      (_unused, index) => this.createSlot(index),
    );
  }

  createSlot(index) {
    const slot = { index, worker: this.workerFactory(), job: null };
    this.attachWorker(slot);
    return slot;
  }

  attachWorker(slot) {
    const worker = slot.worker;
    if (!worker || typeof worker.postMessage !== 'function') {
      throw new TypeError('Tree generation worker must provide postMessage().');
    }
    worker.addEventListener('message', (event) => {
      if (slot.worker === worker) this.handleWorkerMessage(slot, event);
    });
    worker.addEventListener('error', (event) => {
      if (slot.worker === worker) this.handleWorkerFailure(slot, event);
    });
  }

  replaceWorker(slot) {
    slot.worker.terminate?.();
    slot.worker = this.workerFactory();
    slot.job = null;
    this.attachWorker(slot);
  }

  submit({ key, priority = 0, preset, seed, options = {} }) {
    if (this.destroyed) {
      return Promise.reject(new Error('Tree generation worker pool is destroyed.'));
    }
    if (typeof key !== 'string' || key === '') {
      return Promise.reject(new TypeError('Tree generation job key must be non-empty.'));
    }

    const revision = (this.revisions.get(key) ?? 0) + 1;
    const request = createTreeGenerationRequest({
      requestId: `${key}:${revision}`,
      key,
      revision,
      preset,
      seed,
      options,
    });
    const previous = this.jobsByKey.get(key);
    if (previous) this.cancelJob(previous, 'superseded', false);
    this.revisions.set(key, revision);

    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    const job = {
      key,
      priority,
      request,
      promise,
      resolve: resolvePromise,
      reject: rejectPromise,
      state: 'queued',
      slot: null,
      settled: false,
    };
    this.jobsByKey.set(key, job);
    this.queue.enqueue(queueKey(key), priority, () => this.dispatchJob(job));
    this.pump();
    return promise;
  }

  dispatchJob(job) {
    if (job.settled || this.jobsByKey.get(job.key) !== job) return;
    const slot = this.slots.find((candidate) => candidate.job === null);
    if (!slot) {
      this.queue.enqueue(queueKey(job.key), job.priority, () =>
        this.dispatchJob(job),
      );
      return;
    }
    job.state = 'in-flight';
    job.slot = slot;
    slot.job = job;
    slot.worker.postMessage({
      type: TREE_GENERATION_WORKER_MESSAGES.GENERATE,
      request: job.request,
    });
  }

  settleJob(job, callback) {
    if (job.settled) return false;
    job.settled = true;
    if (this.jobsByKey.get(job.key) === job) this.jobsByKey.delete(job.key);
    const slot = job.slot;
    if (slot?.job === job) slot.job = null;
    job.slot = null;
    callback();
    this.pump();
    return true;
  }

  releaseCancelledSlot(slot, job) {
    if (slot.job !== job) return;
    slot.job = null;
    job.slot = null;
    this.pump();
  }

  handleWorkerMessage(slot, event) {
    const job = slot.job;
    const message = event?.data;
    if (!job || !message || message.requestId !== job.request.requestId) return;

    if (job.settled) {
      this.releaseCancelledSlot(slot, job);
      return;
    }
    if (message.type === TREE_GENERATION_WORKER_MESSAGES.RESULT) {
      try {
        validateTreeIr(message.treeIr);
      } catch (error) {
        this.failedCount += 1;
        this.settleJob(job, () => job.reject(error));
        return;
      }
      this.completedCount += 1;
      this.settleJob(job, () => job.resolve(message.treeIr));
      return;
    }
    if (message.type === TREE_GENERATION_WORKER_MESSAGES.ERROR) {
      this.failedCount += 1;
      this.settleJob(job, () => job.reject(restoreWorkerError(message.error)));
    }
  }

  handleWorkerFailure(slot, event) {
    const job = slot.job;
    if (!this.destroyed) this.replaceWorker(slot);
    if (job && !job.settled) {
      this.failedCount += 1;
      const error = new Error(event?.message ?? 'Tree generation worker crashed.');
      this.settleJob(job, () => job.reject(error));
      return;
    }
    this.pump();
  }

  rejectCancelledJob(job, reason) {
    job.settled = true;
    if (this.jobsByKey.get(job.key) === job) this.jobsByKey.delete(job.key);
    this.cancelledCount += 1;
    job.reject(
      new TreeGenerationCancelledError(
        `Tree generation job '${job.key}' was ${reason}.`,
      ),
    );
  }

  cancelJob(job, reason, shouldPump = true) {
    if (job.settled) return false;
    this.queue.cancel(queueKey(job.key));
    const slot = job.slot;
    if (!slot || slot.job !== job) {
      this.rejectCancelledJob(job, reason);
      if (shouldPump) this.pump();
      return true;
    }

    if (this.policy.terminateOnCancel) {
      this.replaceWorker(slot);
      job.slot = null;
      this.rejectCancelledJob(job, reason);
      if (shouldPump) this.pump();
      return true;
    }

    job.state = 'cancelling';
    slot.worker.postMessage({
      type: TREE_GENERATION_WORKER_MESSAGES.CANCEL,
      requestId: job.request.requestId,
    });
    this.rejectCancelledJob(job, reason);
    return true;
  }

  cancel(key) {
    const job = this.jobsByKey.get(key);
    return job ? this.cancelJob(job, 'cancelled') : false;
  }

  pump() {
    if (this.destroyed) return;
    while (
      this.queue.length > 0 &&
      this.slots.some((slot) => slot.job === null)
    ) {
      const before = this.queue.length;
      this.queue.process(0);
      if (this.queue.length >= before) break;
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const job of [...this.jobsByKey.values()]) {
      this.queue.cancel(queueKey(job.key));
      if (!job.settled) {
        job.settled = true;
        job.reject(
          new TreeGenerationCancelledError(
            `Tree generation job '${job.key}' was cancelled by shutdown.`,
          ),
        );
      }
    }
    this.jobsByKey.clear();
    this.queue.clear();
    for (const slot of this.slots) slot.worker.terminate?.();
    this.slots.length = 0;
  }

  get metrics() {
    return Object.freeze({
      workerCount: this.slots.length,
      busyWorkerCount: this.slots.filter((slot) => slot.job !== null).length,
      queuedJobCount: this.queue.length,
      activeJobCount: this.jobsByKey.size,
      completedCount: this.completedCount,
      cancelledCount: this.cancelledCount,
      failedCount: this.failedCount,
    });
  }
}
