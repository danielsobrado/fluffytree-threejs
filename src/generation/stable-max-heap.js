export class StableMaxHeap {
  constructor(compare) {
    if (typeof compare !== 'function') {
      throw new TypeError('StableMaxHeap requires a comparator.');
    }

    this.compare = compare;
    this.entries = [];
  }

  get size() {
    return this.entries.length;
  }

  peek() {
    return this.entries[0] ?? null;
  }

  push(value) {
    const entries = this.entries;
    entries.push(value);
    let index = entries.length - 1;

    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(entries[parent], entries[index]) >= 0) break;
      [entries[parent], entries[index]] = [entries[index], entries[parent]];
      index = parent;
    }
  }

  pop() {
    const entries = this.entries;
    if (entries.length === 0) return null;

    const root = entries[0];
    const tail = entries.pop();
    if (entries.length === 0) return root;

    entries[0] = tail;
    let index = 0;

    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let largest = index;

      if (
        left < entries.length &&
        this.compare(entries[left], entries[largest]) > 0
      ) {
        largest = left;
      }
      if (
        right < entries.length &&
        this.compare(entries[right], entries[largest]) > 0
      ) {
        largest = right;
      }
      if (largest === index) break;

      [entries[index], entries[largest]] = [entries[largest], entries[index]];
      index = largest;
    }

    return root;
  }
}
