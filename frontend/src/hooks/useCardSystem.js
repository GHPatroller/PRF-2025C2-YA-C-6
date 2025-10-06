import { useRef, useCallback } from 'react';

const MAX_YELLOWS = 3;

export const useCardSystem = (clientRef, callbacks = {}) => {
  const yellowByKeyRef = useRef(new Map());   // key -> count
  const redByKeyRef = useRef(new Set());      // set(keys)
  const nameToKeyRef = useRef(new Map());     // displayName -> key
  const keyToLastUserIdRef = useRef(new Map());// key -> last userId visto

  const { onSendNotice, onUserExpelled, onScoreboardUpdate } = callbacks;


  const getUserKey = useCallback((u) =>
      u?.userGuid ||
      u?.userGUID ||
      u?.email ||
      u?.userEmail ||
      u?.userName ||
      u?.displayName ||
      u?.name ||
      u?.userId, // se resetea en la sala de espera
  [], []);

  const getNiceName = useCallback((u) =>
    u?.displayName || u?.userName || u?.name || getUserKey(u) || "Usuario", [getUserKey]
  );

  const touchUserMapping = useCallback((u) => {
    if (!u) return;
    const key = getUserKey(u);
    if (!key) return;
    if (u?.userId) keyToLastUserIdRef.current.set(key, u.userId);
    const name = getNiceName(u);
    if (name && !nameToKeyRef.current.get(name)) nameToKeyRef.current.set(name, key);
  }, [getUserKey, getNiceName]);

  const isRed = useCallback((key) => redByKeyRef.current.has(key), []);

  const addYellow = useCallback(async (user) => {
    if (!user) return;
    touchUserMapping(user);
    const key = getUserKey(user) || nameToKeyRef.current.get(getNiceName(user));
    if (!key) return;

    const prev = yellowByKeyRef.current.get(key) || 0;
    const next = prev + 1;
    yellowByKeyRef.current.set(key, next);

    await onSendNotice?.("yellow", user, next);
    onScoreboardUpdate?.();

    if (next >= MAX_YELLOWS) {
      await escalateToRed(user); // eslint-disable-line no-use-before-define
    }
  }, [getUserKey, getNiceName, touchUserMapping, onSendNotice, onScoreboardUpdate]);

  const escalateToRed = useCallback(async (user) => {
    if (!user) return;
    touchUserMapping(user);

    const key = getUserKey(user) || nameToKeyRef.current.get(getNiceName(user));
    if (!key) return;

    redByKeyRef.current.add(key);
    await onSendNotice?.("red", user);

    const uid = keyToLastUserIdRef.current.get(key) || user?.userId;

    try { await clientRef.current?.expel?.(uid); } catch {}
    try { await clientRef.current?.putOnHold?.(uid, true); } catch {}

    if (uid) onUserExpelled?.(uid);
    onScoreboardUpdate?.();
  }, [getUserKey, getNiceName, touchUserMapping, onSendNotice, onUserExpelled, onScoreboardUpdate, clientRef]);

  const putOnHoldWithCards = useCallback(async (user) => {
    if (!user || user.isHost || user.isCohost) return;
    touchUserMapping(user);

    const key = getUserKey(user) || nameToKeyRef.current.get(getNiceName(user));
    const uid = keyToLastUserIdRef.current.get(key) || user?.userId;
    if (!uid) return;

    if (isRed(key)) {
      try {
        await clientRef.current?.putOnHold?.(uid, true);
        await onSendNotice?.("red", user);
      } catch (err) {
        console.error("❌ Error putOnHold (red):", err);
      } finally {
        onScoreboardUpdate?.();
      }
      return;
    }

    try {
      await clientRef.current?.putOnHold?.(uid, true);
      await addYellow(user);
      await onSendNotice?.("info", user);
    } catch (err) {
      console.error("❌ Error putOnHold:", err);
    } finally {
      onScoreboardUpdate?.();
    }
  }, [getUserKey, getNiceName, touchUserMapping, isRed, clientRef, addYellow, onSendNotice, onScoreboardUpdate]);

  const getScoreboard = useCallback((roster = []) => {
    const rows = roster
      .filter((u) => !u.isHost && !u.isCohost)
      .map((u) => {
        touchUserMapping(u);
        const key = getUserKey(u) || nameToKeyRef.current.get(getNiceName(u));
        return {
          id: key,
          name: getNiceName(u),
          cam: u?.bVideoOn === true ? "ON" : u?.bVideoOn === false ? "OFF" : "N/D",
          yellows: yellowByKeyRef.current.get(key) || 0,
          red: redByKeyRef.current.has(key),
        };
      })
      .sort((a, b) => (b.red - a.red) || (b.yellows - a.yellows));
    return rows;
  }, [getUserKey, getNiceName, touchUserMapping]);

  const resetCards = useCallback(() => {
    yellowByKeyRef.current.clear();
    redByKeyRef.current.clear();
    onScoreboardUpdate?.();
  }, [onScoreboardUpdate]);

  return {
    addYellow,
    escalateToRed,
    putOnHoldWithCards,
    getScoreboard,
    resetCards,
    isRed,
    yellowByKey: yellowByKeyRef.current,
    redByKey: redByKeyRef.current,
    nameToKeyRef: nameToKeyRef.current,
    keyToLastUserIdRef: keyToLastUserIdRef.current,
  };
};
