function validatePriority(priority) {
  if (!Number.isFinite(priority)) {
    throw new TypeError('Prioritized task priority must be finite.');
  }
  return priority;
}

function higherPriority(left, right) {
  if (left.priority !== right.priority) return left.priority > right.priority;
  return left.sequence < right.sequence;
}

export class PrioritizedFrameBudgetQueue {
  constructor({ now = () => performance.now() } = {}) {
    this.now = now;
    this.heap = [];
    this.entries = new Map();
    this.sequence = 0;
    this.lastProcessDuration = 0;
    this.maximumTaskDuration = 0;
    this.staleSkipCount = 0;
  }

  swap(left, right) {
    [this.heap[left], this.heap[right]] = [this.heap[right], this.heap[left]];
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!higherPriority(this.heap[index], this.heap[parent])) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  bubbleDown(index) {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let best = index;
      if (
        left < this.heap.length &&
        higherPriority(this.heap[left], this.heap[best])
      ) {
        best = left;
      }
      if (
        right < this.heap.length &&
        higherPriority(this.heap[right], this.heap[best])
      ) {
        best = right;
      }
      if (best === index) return;
      this.swap(index, best);
      index = best;
    }
  }

  push(entry) {
    this.heap.push(entry);
    this.bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const root = this.heap[0];
    const tail = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = tail;
      this.bubbleDown(0);
    }
    return root;
  }

  enqueue(key, priority, task) {
    if (typeof task !== 'function') {
      throw new TypeError('Prioritized task must be a function.');
    }
    const entry = {
      key,
      priority: validatePriority(priority),
      task,
      sequence: this.sequence,
    };
    this.sequence += 1;
    this.entries.set(key, entry);
    this.push(entry);
    return entry;
  }

  cancel(key) {
    return this.entries.delete(key);
  }

  takeCurrentEntry() {
    while (this.heap.length > 0) {
      const entry = this.pop();
      if (this.entries.get(entry.key) === entry) {
        this.entries.delete(entry.key);
        return entry;
      }
      this.staleSkipCount += 1;
    }
    return null;
  }

  process(budgetMilliseconds) {
    if (!Number.isFinite(budgetMilliseconds) || budgetMilliseconds < 0) {
      throw new RangeError('Prioritized queue budget must be non-negative.');
    }
    const started = this.now();
    let processed = 0;

    try {
      while (this.entries.size > 0) {
        const entry = this.takeCurrentEntry();
        if (!entry) break;
        const taskStarted = this.now();
        try {
          entry.task();
        } finally {
          this.maximumTaskDuration = Math.max(
            this.maximumTaskDuration,
            this.now() - taskStarted,
          );
        }
        processed += 1;
        if (this.now() - started >= budgetMilliseconds) break;
      }
      return processed;
    } finally {
      this.lastProcessDuration = this.now() - started;
    }
  }

  clear() {
    this.heap.length = 0;
    this.entries.clear();
    this.lastProcessDuration = 0;
    this.maximumTaskDuration = 0;
  }

  get length() {
    return this.entries.size;
  }
}
