import { useRef } from 'react';
import { userUtils } from './utils/userUtils';
import { timerUtils } from './utils/timerUtils';

const GRACE_MS = 10_000;
const STABILIZE_MS = 1200;

export const useVideoControl = (clientRef, onUserHold) => {
  const stabilizeTimersRef = useRef(new Map());
  const graceTimersRef = useRef(new Map());
  const heldSetRef = useRef(new Set());

  const holdOnce = async (user) => {
    if (!userUtils.isRegularUser(user)) return;
    if (heldSetRef.current.has(user.userId)) return;

    try {
      await clientRef.current.putOnHold(user.userId, true);
      heldSetRef.current.add(user.userId);
      console.log(`🚪 ${user.displayName || user.userId} a Waiting Room`);
      
      if (onUserHold) onUserHold(user);
    } catch (err) {
      console.error('❌ Error putOnHold:', err);
    } finally {
      timerUtils.clearAllTimers(user.userId, stabilizeTimersRef.current, graceTimersRef.current);
    }
  };

  const handleVideoState = (user) => {
    if (!userUtils.isRegularUser(user)) return;

    if (user.bVideoOn === true) {
      timerUtils.clearAllTimers(user.userId, stabilizeTimersRef.current, graceTimersRef.current);
      return;
    }

    if (!userUtils.isBool(user.bVideoOn)) {
      if (!stabilizeTimersRef.current.has(user.userId)) {
        timerUtils.createStabilizeTimer(
          user.userId,
          () => {
            const fresh = userUtils.findUserFromPayload({ userId: user.userId }, clientRef) || user;
            handleVideoState(fresh);
          },
          STABILIZE_MS,
          stabilizeTimersRef.current
        );
        console.log(`⏳ Esperando estado cámara de ${user.displayName || user.userId}`);
      }
      return;
    }

    // bVideoOn === false
    if (!graceTimersRef.current.has(user.userId)) {
      timerUtils.createGraceTimer(
        user.userId,
        async () => {
          const fresh = userUtils.findUserFromPayload({ userId: user.userId }, clientRef) || user;
          if (fresh?.bVideoOn === false) {
            await holdOnce(fresh);
            console.log(`⏱️ Grace agotado para ${fresh.displayName || fresh.userId}`);
          } else {
            console.log(`✅ ${fresh?.displayName || user.userId} encendió cámara a tiempo`);
            timerUtils.clearAllTimers(user.userId, stabilizeTimersRef.current, graceTimersRef.current);
          }
        },
        GRACE_MS,
        graceTimersRef.current
      );
      console.log(`⏳ Grace ${GRACE_MS / 1000}s para ${user.displayName || user.userId}`);
    }
  };

  const clearUserTimers = (userId) => {
    timerUtils.clearAllTimers(userId, stabilizeTimersRef.current, graceTimersRef.current);
    heldSetRef.current.delete(userId);
  };

  const cleanup = () => {
    timerUtils.clearAllTimersInMap(stabilizeTimersRef.current);
    timerUtils.clearAllTimersInMap(graceTimersRef.current);
    heldSetRef.current.clear();
  };

  return {
    handleVideoState,
    clearUserTimers,
    cleanup
  };
};