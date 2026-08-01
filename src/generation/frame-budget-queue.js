export class FrameBudgetQueue {
  constructor({ now = () => performance.now() } = {}) {
    this.now = now;
    this.tasks = [];
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

  process(budgetMilliseconds) {
    const started = this.now();
    let processed = 0;
    while (this.tasks.length > 0) {
      const entry = this.tasks.shift();
      this.keys.delete(entry.key);
      const taskStarted = this.now();
      entry.task();
      this.maximumTaskDuration = Math.max(
        this.maximumTaskDuration,
        this.now() - taskStarted,
      );
      processed += 1;
      if (this.now() - started >= budgetMilliseconds) break;
    }
    this.lastProcessDuration = this.now() - started;
    return processed;
  }

  clear() {
    this.tasks.length = 0;
    this.keys.clear();
    this.lastProcessDuration = 0;
    this.maximumTaskDuration = 0;
  }

  get length() {
    return this.tasks.length;
  }
}
