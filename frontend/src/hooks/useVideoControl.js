import { useRef, useCallback } from 'react';
import { TimerManager } from '../utils/timerUtils';
import { isBool, shouldManageUser } from '../utils/userUtils';

const GRACE_MS = 10_000;
const STABILIZE_MS = 1200;

export const INCIDENT = {
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
  // Timers de cámara
  const stabilizeCamRef = useRef(new TimerManager());
  const graceCamRef = useRef(new TimerManager());
  // Timers de mic
  const stabilizeMicRef = useRef(new TimerManager());
  const graceMicRef = useRef(new TimerManager());

  const heldSetRef = useRef(new Set());
  const { onHoldUser, onClearTimers } = callbacks;

  const clearAllTimers = useCallback((userId) => {
    stabilizeCamRef.current.clearTimer(userId);
    graceCamRef.current.clearTimer(userId);
    stabilizeMicRef.current.clearTimer(userId);
    graceMicRef.current.clearTimer(userId);
  }, []);

  // === Helpers para saber si debo mantener/ejecutar timers ===
  const isInRoster = useCallback((id) => {
    try {
      const roster = getRoster?.() || [];
      return roster.some(u => (u.userId ?? u.id ?? u.uid) === id);
    } catch {
      return false;
    }
  }, [getRoster]);

  const isActiveParticipant = useCallback((id) => {
    // Activo = sigue en roster y NO está en el set de held (waiting)
    return !!id && isInRoster(id) && !heldSetRef.current.has(id);
  }, [isInRoster]);

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
      clearAllTimers(user.userId); // cortar todo si fue a waiting
    }
  }, [callbacks.onPutOnHold, onHoldUser, clearAllTimers]);

  // ======== CÁMARA ========
  const handleVideoState = useCallback((user, source = 'video') => {
    if (source !== 'video') return;             // blindaje extra
    if (!shouldManageUser(user)) return;

    const id = user.userId ?? user.id ?? user.uid;
    // Si ya NO es participante activo (p. ej. fue a waiting), limpiar y salir
    if (!isActiveParticipant(id)) {
      clearAllTimers(id);
      return;
    }

    if (user.bVideoOn === true || user.video?.on === true) {
      stabilizeCamRef.current.clearTimer(id);
      graceCamRef.current.clearTimer(id);
      return;
    }

    const bVideoOn = (user.bVideoOn ?? user.video?.on);
    // Estado inestable/desconocido -> estabilizar
    if (!isBool(bVideoOn)) {
      if (!stabilizeCamRef.current.hasTimer(id)) {
        stabilizeCamRef.current.setTimer(
          id,
          () => {
            // Revalidar al ejecutar el timer
            if (!isActiveParticipant(id)) {
              clearAllTimers(id);
              return;
            }
            onClearTimers?.(id);
            const fresh = getRoster().find((u) => (u.userId ?? u.id ?? u.uid) === id) || user;
            callbacks.onStabilized?.(fresh, INCIDENT.CAMERA_OFF);
          },
          STABILIZE_MS
        );
        console.log(`⏳ Esperando estado cámara de ${user.displayName || id} (${STABILIZE_MS}ms)`);
      }
      return;
    }

    // Cámara OFF -> iniciar grace cámara
    if (!graceCamRef.current.hasTimer(id)) {
      graceCamRef.current.setTimer(
        id,
        () => {
          if (!isActiveParticipant(id)) {
            clearAllTimers(id);
            return;
          }
          onClearTimers?.(id);
          const fresh = getRoster().find((u) => (u.userId ?? u.id ?? u.uid) === id) || user;
          callbacks.onGraceEnd?.(fresh, INCIDENT.CAMERA_OFF);
        },
        GRACE_MS
      );
      console.log(`⏳ Grace ${GRACE_MS / 1000}s para ${user.displayName || id} (cámara OFF)`);
    }
  }, [getRoster, onClearTimers, callbacks, isActiveParticipant, clearAllTimers]);

  // ======== MICRO ========
  const handleAudioState = useCallback((user, source = 'audio') => {
    if (source !== 'audio') return;            // blindaje extra
    if (!shouldManageUser(user)) return;

    const id = user.userId ?? user.id ?? user.uid;
    if (!isActiveParticipant(id)) {
      clearAllTimers(id);
      return;
    }

    const micOn = isMicOn(user);

    if (micOn === true) {
      stabilizeMicRef.current.clearTimer(id);
      graceMicRef.current.clearTimer(id);
      return;
    }

    // mic OFF -> iniciar grace mic
    if (!graceMicRef.current.hasTimer(id)) {
      graceMicRef.current.setTimer(
        id,
        () => {
          if (!isActiveParticipant(id)) {
            clearAllTimers(id);
            return;
          }
          onClearTimers?.(id);
          const fresh = getRoster().find((u) => (u.userId ?? u.id ?? u.uid) === id) || user;
          callbacks.onGraceEnd?.(fresh, INCIDENT.MIC_OFF);
        },
        GRACE_MS
      );
      console.log(`⏳ Grace ${GRACE_MS / 1000}s para ${user.displayName || id} (micrófono OFF)`);
    }
  }, [getRoster, onClearTimers, callbacks, isActiveParticipant, clearAllTimers]);

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
    heldSet: heldSetRef.current,
  };
};
