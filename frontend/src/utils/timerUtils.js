export class TimerManager {
  constructor() {
    this.map = new Map();
  }
  setTimer(key, fn, ms) {
    this.clearTimer(key);
    const id = setTimeout(() => {
      this.map.delete(key);
      try { fn?.(); } catch (e) { console.error(e); }
    }, ms);
    this.map.set(key, id);
    return id;
  }
  hasTimer(key) {
    return this.map.has(key);
  }
  clearTimer(key) {
    const id = this.map.get(key);
    if (id) {
      clearTimeout(id);
      this.map.delete(key);
    }
  }
  clearAll() {
    for (const id of this.map.values()) clearTimeout(id);
    this.map.clear();
  }
}
