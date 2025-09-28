// src/hooks/useCardSystem.js
import { useRef, useCallback } from 'react';

const MAX_YELLOWS = 3;

export const useCardSystem = (clientRef, callbacks) => {
  const yellowByKeyRef = useRef(new Map());
  const redByKeyRef = useRef(new Set());
  const nameToKeyRef = useRef(new Map());
  const keyToLastUserIdRef = useRef(new Map());

  const { onSendNotice, onUserExpelled, onScoreboardUpdate } = callbacks;

  const getUserKey = useCallback((user) => {
    return user?.userId || user?.userID || user?.userGUID || user?.userGuid;
  }, []);

  const getNiceName = useCallback((user) => {
    return user?.displayName || user?.userName || 'Usuario';
  }, []);

  const touchUserMapping = useCallback((user, context = "") => {
    const key = getUserKey(user);
    const name = getNiceName(user);
    if (key && name) {
      nameToKeyRef.current.set(name, key);
      keyToLastUserIdRef.current.set(key, user?.userId);
    }
  }, [getUserKey, getNiceName]);

  const isRed = useCallback((key) => {
    return redByKeyRef.current.has(key);
  }, []);

  const addYellow = useCallback(async (user) => {
    const key = getUserKey(user) || nameToKeyRef.current.get(getNiceName(user));
    if (!key) return;

    const prev = yellowByKeyRef.current.get(key) || 0;
    const next = prev + 1;
    yellowByKeyRef.current.set(key, next);

    await onSendNotice?.("yellow", user, next);
    onScoreboardUpdate?.();

    if (next >= MAX_YELLOWS) {
      await escalateToRed(user);
    }
  }, [getUserKey, getNiceName, onSendNotice, onScoreboardUpdate]);

  const escalateToRed = useCallback(async (user) => {
    const key = getUserKey(user) || nameToKeyRef.current.get(getNiceName(user));
    if (!key) return;

    redByKeyRef.current.add(key);
    await onSendNotice?.("red", user);

    const uid = keyToLastUserIdRef.current.get(key) || user?.userId;
    
    // Expulsar usuario
    try { 
      await clientRef.current?.expel?.(uid); 
    } catch {}
    
    try { 
      await clientRef.current?.putOnHold?.(uid, true); 
    } catch {}

    if (uid) {
      onUserExpelled?.(uid);
    }

    onScoreboardUpdate?.();
  }, [getUserKey, getNiceName, onSendNotice, onUserExpelled, onScoreboardUpdate, clientRef]);

  const putOnHoldWithCards = useCallback(async (user) => {
    if (!user || user.isHost || user.isCohost) return;
    touchUserMapping(user, "holdOnce");

    const key = getUserKey(user) || nameToKeyRef.current.get(getNiceName(user));
    const uid = keyToLastUserIdRef.current.get(key) || user?.userId;
    if (!uid) return;

    if (isRed(key)) {
      try {
        await clientRef.current.putOnHold(uid, true);
        await onSendNotice?.("red", user);
      } catch (err) {
        console.error("❌ Error putOnHold (red):", err);
      } finally {
        onUserExpelled?.(uid);
        onScoreboardUpdate?.();
      }
      return;
    }

    try {
      await clientRef.current.putOnHold(uid, true);
      console.log(`🚪 ${getNiceName(user)} a Waiting Room`);
      await addYellow(user);
      await onSendNotice?.("info", user);
    } catch (err) {
      console.error("❌ Error putOnHold:", err);
    } finally {
      onUserExpelled?.(uid);
      onScoreboardUpdate?.();
    }
  }, [getUserKey, getNiceName, touchUserMapping, isRed, addYellow, onSendNotice, onUserExpelled, onScoreboardUpdate, clientRef]);

  const getScoreboard = useCallback((roster) => {
    return roster
      .filter((u) => !u.isHost && !u.isCohost)
      .map((u) => {
        touchUserMapping(u, "score");
        const key = getUserKey(u) || nameToKeyRef.current.get(getNiceName(u));
        return {
          id: key,
          name: getNiceName(u),
          cam: u.bVideoOn === true ? "ON" : u.bVideoOn === false ? "OFF" : "N/D",
          yellows: yellowByKeyRef.current.get(key) || 0,
          red: redByKeyRef.current.has(key),
        };
      })
      .sort((a, b) => (b.red - a.red) || (b.yellows - a.yellows));
  }, [getUserKey, getNiceName, touchUserMapping]);

  const resetCards = useCallback((userId) => {
    const key = getUserKey({ userId });
    if (key) {
      yellowByKeyRef.current.delete(key);
      redByKeyRef.current.delete(key);
      onScoreboardUpdate?.();
    }
  }, [getUserKey, onScoreboardUpdate]);

  return {
    addYellow,
    escalateToRed,
    putOnHoldWithCards,
    getScoreboard,
    resetCards,
    isRed,
    yellowByKey: yellowByKeyRef.current,
    redByKey: redByKeyRef.current
  };
};