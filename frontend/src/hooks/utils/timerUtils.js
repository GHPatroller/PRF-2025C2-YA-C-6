export const timerUtils = {
  createStabilizeTimer: (userId, callback, stabilizeMs, timersMap) => {
    timerUtils.clearStabilizeTimer(userId, timersMap);
    
    const temp = setTimeout(() => {
      timersMap.delete(userId);
      callback();
    }, stabilizeMs);
    
    timersMap.set(userId, temp);
    return temp;
  },
  
  createGraceTimer: (userId, callback, graceMs, timersMap) => {
    timerUtils.clearGraceTimer(userId, timersMap);
    
    const tid = setTimeout(callback, graceMs);
    timersMap.set(userId, tid);
    return tid;
  },
  
  clearStabilizeTimer: (userId, timersMap) => {
    const t = timersMap.get(userId);
    if (t) clearTimeout(t);
    timersMap.delete(userId);
  },
  
  clearGraceTimer: (userId, timersMap) => {
    const t = timersMap.get(userId);
    if (t) clearTimeout(t);
    timersMap.delete(userId);
  },
  
  clearAllTimers: (userId, stabilizeTimers, graceTimers) => {
    timerUtils.clearStabilizeTimer(userId, stabilizeTimers);
    timerUtils.clearGraceTimer(userId, graceTimers);
  },
  
  clearAllTimersInMap: (timersMap) => {
    timersMap.forEach((t) => clearTimeout(t));
    timersMap.clear();
  }
};