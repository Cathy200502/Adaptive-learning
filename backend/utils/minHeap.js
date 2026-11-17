/**
 * A plain binary min-heap (array backed, no dependencies).
 *
 * Used by services/adaptiveEngine.js as the "next question" selector: every
 * eligible question is pushed once with a priority (lower = more suitable
 * right now), then a single pop() returns the best match in O(log n) instead
 * of scanning the bank by hand. Ties and soft preferences (retry vs unseen,
 * recently-shown vs fresh) are expressed purely through the priority number,
 * so the heap itself stays generic and reusable.
 */
class MinHeap {
  constructor() {
    this.items = []; // [{ priority, value }]
  }

  get size() {
    return this.items.length;
  }

  push(value, priority) {
    this.items.push({ value, priority });
    this._bubbleUp(this.items.length - 1);
  }

  /** Removes and returns the value with the lowest priority, or null if empty. */
  pop() {
    if (!this.items.length) return null;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length) {
      this.items[0] = last;
      this._bubbleDown(0);
    }
    return top.value;
  }

  peekPriority() {
    return this.items.length ? this.items[0].priority : null;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= this.items[i].priority) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  _bubbleDown(i) {
    const n = this.items.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      if (left < n && this.items[left].priority < this.items[smallest].priority) smallest = left;
      if (right < n && this.items[right].priority < this.items[smallest].priority) smallest = right;
      if (smallest === i) break;
      [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
      i = smallest;
    }
  }
}

module.exports = MinHeap;
