export class FrameBudgetQueue {
  constructor({ now = () => performance.now() } = {}) {
    this.now = now;
    this.tasks = [];
    this.head = 0;
    this.keys = new Set();
    this.lastProcessDuration = 0;
    this.maximumTaskDuration = 0;
  }

  enqueue(key, task) {
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    this.tasks.push({ key, task });
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
    if (this.head >= this.tasks.length) {
      this.lastProcessDuration = 0;
      this.compact();
      return 0;
    }

    const started = this.now();
    let processed = 0;

    try {
      while (this.head < this.tasks.length) {
        const entry = this.tasks[this.head];
        this.head += 1;
        this.keys.delete(entry.key);
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
      this.compact();
    }
  }

  clear() {
    this.tasks.length = 0;
    this.head = 0;
    this.keys.clear();
    this.lastProcessDuration = 0;
    this.maximumTaskDuration = 0;
  }

  get length() {
    return this.tasks.length - this.head;
  }
}
