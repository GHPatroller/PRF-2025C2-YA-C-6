import { useRef, useCallback } from 'react';
import { TimerManager } from '../utils/timerUtils';
import { isBool, shouldManageUser } from '../utils/userUtils';

const GRACE_MS = 10_000;
const STABILIZE_MS = 1200;

const INCIDENT = {
  CAMERA_OFF: 'cameraOff',
  MIC_OFF: 'micOff',
};


function isMicOn(user) {
  const muted =
    user?.muted ??
    user?.audio?.muted ??
    user?.audioStatus?.isMuted ??
    user?.status?.audio?.muted;
  return muted === undefined ? true : !muted;
}

export const useVideoControls = (clientRef, getRoster, callbacks) => {
  // Timers para cámara
  const stabilizeCamRef = useRef(new TimerManager());
  const graceCamRef = useRef(new TimerManager());
  // Timers para micrófono
  const stabilizeMicRef = useRef(new TimerManager());
  const graceMicRef = useRef(new TimerManager());

  const heldSetRef = useRef(new Set());

  const { onHoldUser, onClearTimers } = callbacks;

  const clearAllTimers = useCallback((userId) => {
    // cámara
    stabilizeCamRef.current.clearTimer(userId);
    graceCamRef.current.clearTimer(userId);
    // mic
    stabilizeMicRef.current.clearTimer(userId);
    graceMicRef.current.clearTimer(userId);
  }, []);

  const putOnHold = useCallback(async (user) => {
    if (!user?.userId || heldSetRef.current.has(user.userId)) return false;

    let ok = false;
    try {
      ok = await callbacks.onPutOnHold?.(user);
      if (ok === true) {
        heldSetRef.current.add(user.userId);
        onHoldUser?.(user);
      } else {
        console.warn('⏭️ No se marcó en espera porque onPutOnHold() no tuvo éxito');
      }
      return ok;
    } catch (err) {
      console.error('❌ Error putOnHold:', err);
      return false;
    } finally {
      clearAllTimers(user.userId);
    }
  }, [callbacks.onPutOnHold, onHoldUser, clearAllTimers]);

  // ======== CÁMARA ========
  const handleVideoState = useCallback((user) => {
    if (!shouldManageUser(user)) return;

    if (user.bVideoOn === true) {
      stabilizeCamRef.current.clearTimer(user.userId);
      graceCamRef.current.clearTimer(user.userId);
      return;
    }

    if (!isBool(user.bVideoOn)) {
      // Estado indefinido -> estabilizar
      if (!stabilizeCamRef.current.hasTimer(user.userId)) {
        stabilizeCamRef.current.setTimer(
          user.userId,
          () => {
            onClearTimers?.(user.userId);
            const fresh = getRoster().find((u) => u.userId === user.userId) || user;
            callbacks.onStabilized?.(fresh, INCIDENT.CAMERA_OFF);
          },
          STABILIZE_MS
        );
        console.log(`⏳ Esperando estado cámara de ${user.displayName || user.userId} (${STABILIZE_MS}ms)`);
      }
      return;
    }

    //iniciar grace camara
    if (!graceCamRef.current.hasTimer(user.userId)) {
      graceCamRef.current.setTimer(
        user.userId,
        () => {
          onClearTimers?.(user.userId);
          const fresh = getRoster().find((u) => u.userId === user.userId) || user;
          callbacks.onGraceEnd?.(fresh, INCIDENT.CAMERA_OFF);
        },
        GRACE_MS
      );
      console.log(`⏳ Grace ${GRACE_MS / 1000}s para ${user.displayName || user.userId} (cámara OFF)`);
    }
  }, [getRoster, onClearTimers, callbacks]);

  // ======== MICRO ========
  const handleAudioState = useCallback((user) => {
    if (!shouldManageUser(user)) return;

    const micOn = isMicOn(user);

    if (micOn === true) {
      stabilizeMicRef.current.clearTimer(user.userId);
      graceMicRef.current.clearTimer(user.userId);
      return;
    }

    // Muchos SDKs informan muted/no muted sin "indefinido"
    if (!isBool(micOn)) {
      if (!stabilizeMicRef.current.hasTimer(user.userId)) {
        stabilizeMicRef.current.setTimer(
          user.userId,
          () => {
            onClearTimers?.(user.userId);
            const fresh = getRoster().find((u) => u.userId === user.userId) || user;
            callbacks.onStabilized?.(fresh, INCIDENT.MIC_OFF);
          },
          STABILIZE_MS
        );
        console.log(`⏳ Esperando estado mic de ${user.displayName || user.userId} (${STABILIZE_MS}ms)`);
      }
      return;
    }

    // mic OFF -> iniciar grace mic
    if (!graceMicRef.current.hasTimer(user.userId)) {
      graceMicRef.current.setTimer(
        user.userId,
        () => {
          onClearTimers?.(user.userId);
          const fresh = getRoster().find((u) => u.userId === user.userId) || user;
          callbacks.onGraceEnd?.(fresh, INCIDENT.MIC_OFF);
        },
        GRACE_MS
      );
      console.log(`⏳ Grace ${GRACE_MS / 1000}s para ${user.displayName || user.userId} (micrófono OFF)`);
    }
  }, [getRoster, onClearTimers, callbacks]);

  const clearUserState = useCallback((userId) => {
    clearAllTimers(userId);
    heldSetRef.current.delete(userId);
  }, [clearAllTimers]);

  const cleanup = useCallback(() => {
    stabilizeCamRef.current.clearAll();
    graceCamRef.current.clearAll();
    stabilizeMicRef.current.clearAll();
    graceMicRef.current.clearAll();
    heldSetRef.current.clear();
  }, []);

  const setPaused = useCallback((paused) => {
    if (paused) {
      stabilizeCamRef.current.clearAll();
      graceCamRef.current.clearAll();
      stabilizeMicRef.current.clearAll();
      graceMicRef.current.clearAll();
    }
    callbacks.onPauseStateChange?.(paused);
  }, [callbacks.onPauseStateChange]);

  return {
    handleVideoState,
    handleAudioState,          
    putOnHold,
    clearUserState,
    cleanup,
    setPaused,
    heldSet: heldSetRef.current
  };
};
