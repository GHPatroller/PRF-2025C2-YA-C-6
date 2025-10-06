import { useRef, useCallback } from 'react';
import { TimerManager } from '../utils/timerUtils';
import { isBool, shouldManageUser } from '../utils/userUtils';

const GRACE_MS = 10_000;
const STABILIZE_MS = 1200;

export const useVideoControls = (clientRef, getRoster, callbacks) => {
  const stabilizeTimersRef = useRef(new TimerManager());
  const graceTimersRef = useRef(new TimerManager());
  const heldSetRef = useRef(new Set());

  const { onHoldUser, onClearTimers } = callbacks;

  const clearAllTimers = useCallback((userId) => {
    stabilizeTimersRef.current.clearTimer(userId);
    graceTimersRef.current.clearTimer(userId);
  }, []);

  const putOnHold = useCallback(async (user) => {
    if (!user?.userId || heldSetRef.current.has(user.userId)) return;

    try {
      
      await callbacks.onPutOnHold?.(user);
      heldSetRef.current.add(user.userId);
      onHoldUser?.(user);
    } catch (err) {
      console.error('❌ Error putOnHold:', err);
      throw err;
    } finally {
      clearAllTimers(user.userId);
    }
  }, [callbacks.onPutOnHold, onHoldUser, clearAllTimers]);

  const handleVideoState = useCallback((user) => {
    if (!shouldManageUser(user)) return;

    if (user.bVideoOn === true) {
      clearAllTimers(user.userId);
      heldSetRef.current.delete(user.userId);
      return;
    }

    if (!isBool(user.bVideoOn)) {
      // Estado indefinido -> estabilizar
      if (!stabilizeTimersRef.current.hasTimer(user.userId)) {
        stabilizeTimersRef.current.setTimer(user.userId, () => {
          onClearTimers?.(user.userId);
          const fresh = getRoster().find((u) => u.userId === user.userId) || user;
          callbacks.onStabilized?.(fresh);
        }, STABILIZE_MS);
        
        console.log(
          `⏳ Esperando estado cámara de ${user.displayName || user.userId} (${STABILIZE_MS}ms)`
        );
      }
      return;
    }

    // bVideoOn === false
    if (!graceTimersRef.current.hasTimer(user.userId)) {
      graceTimersRef.current.setTimer(user.userId, () => {
        onClearTimers?.(user.userId);
        const fresh = getRoster().find((u) => u.userId === user.userId) || user;
        callbacks.onGraceEnd?.(fresh);
      }, GRACE_MS);
      
      console.log(
        `⏳ Grace ${GRACE_MS / 1000}s para ${user.displayName || user.userId} (cámara OFF)`
      );
    }
  }, [clearAllTimers, getRoster, onClearTimers, callbacks]);

  const clearUserState = useCallback((userId) => {
    clearAllTimers(userId);
    heldSetRef.current.delete(userId);
  }, [clearAllTimers]);

  const cleanup = useCallback(() => {
    stabilizeTimersRef.current.clearAll();
    graceTimersRef.current.clearAll();
    heldSetRef.current.clear();
  }, []);

  const setPaused = useCallback((paused) => {
  if (paused) {
    stabilizeTimersRef.current.clearAll();
    graceTimersRef.current.clearAll();
  }
  callbacks.onPauseStateChange?.(paused);
}, [callbacks.onPauseStateChange]);

  return {
    handleVideoState,
    putOnHold,
    clearUserState,
    cleanup,
    setPaused,
    heldSet: heldSetRef.current
  };
};