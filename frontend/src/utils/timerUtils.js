export class TimerManager {
  constructor() {
    this.timers = new Map();
  }

  setTimer(key, callback, delay) {
    this.clearTimer(key);
    const timerId = setTimeout(() => {
      this.timers.delete(key);
      callback();
    }, delay);
    this.timers.set(key, timerId);
    return timerId;
  }

  clearTimer(key) {
    const timerId = this.timers.get(key);
    if (timerId) {
      clearTimeout(timerId);
      this.timers.delete(key);
    }
  }

  clearAll() {
    this.timers.forEach((timerId) => clearTimeout(timerId));
    this.timers.clear();
  }

  hasTimer(key) {
    return this.timers.has(key);
  }
}