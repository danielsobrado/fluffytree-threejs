function requireBudget(value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('Frame budget must be non-negative.');
  }
  return value;
}

export class FrameBudgetQueue {
  constructor({ now = () => performance.now() } = {}) {
    if (typeof now !== 'function') {
      throw new TypeError('FrameBudgetQueue now must be a function.');
    }
    this.now = now;
    this.tasks = [];
    this.head = 0;
    this.keys = new Set();
    this.lastProcessDuration = 0;
    this.lastTaskDuration = 0;
    this.maximumTaskDuration = 0;
  }

  enqueue(key, task) {
    if (typeof task !== 'function') {
      throw new TypeError('Frame budget task must be a function.');
    }
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    this.tasks.push({ key, task });
    return true;
  }

  cancel(key) {
    if (!this.keys.delete(key)) return false;
    const index = this.tasks.findIndex(
      (entry, entryIndex) => entryIndex >= this.head && entry.key === key,
    );
    if (index < 0) return false;
    this.tasks.splice(index, 1);
    this.compact();
    return true;
  }

  compact() {
    if (this.head === 0) return;
    if (this.head === this.tasks.length) {
      this.tasks.length = 0;
      this.head = 0;
      return;
    }
    if (this.head < 1024 || this.head * 2 < this.tasks.length) return;

    this.tasks.splice(0, this.head);
    this.head = 0;
  }

  process(budgetMilliseconds) {
    const budget = requireBudget(budgetMilliseconds);
    if (this.head >= this.tasks.length) {
      this.lastProcessDuration = 0;
      this.compact();
      return 0;
    }

    const started = this.now();
    let processed = 0;

    try {
      while (this.head < this.tasks.length) {
        const elapsed = this.now() - started;
        if (
          processed > 0 &&
          this.lastTaskDuration > 0 &&
          elapsed + this.lastTaskDuration > budget
        ) {
          break;
        }

        const entry = this.tasks[this.head];
        this.head += 1;
        this.keys.delete(entry.key);
        const taskStarted = this.now();

        try {
          entry.task();
        } finally {
          this.lastTaskDuration = this.now() - taskStarted;
          this.maximumTaskDuration = Math.max(
            this.maximumTaskDuration,
            this.lastTaskDuration,
          );
        }

        processed += 1;
        if (this.now() - started >= budget) break;
      }

      return processed;
    } finally {
      this.lastProcessDuration = this.now() - started;
      this.compact();
    }
  }

  clear() {
    this.tasks.length = 0;
    this.head = 0;
    this.keys.clear();
    this.lastProcessDuration = 0;
    this.lastTaskDuration = 0;
    this.maximumTaskDuration = 0;
  }

  get length() {
    return this.tasks.length - this.head;
  }
}
