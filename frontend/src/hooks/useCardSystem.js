import React, { useRef, useCallback } from "react";

const MAX_YELLOWS = 3;
const COOLDOWN_MS = 4000;
const ACTIVE_WINDOW_MS = 30_000;

export const useCardSystem = (clientRef, callbacks = {}) => {
  const yellowByKeyRef = useRef(new Map());
  const redByKeyRef = useRef(new Set());
  const nameToKeyRef = useRef(new Map());
  const userIdToKeyRef = useRef(new Map());
  const keyToLastUserIdRef = useRef(new Map());
  const inFlightRef = useRef(new Set());
  const lastYellowAtRef = useRef(new Map());
  const lastSeenAtRef = useRef(new Map());
  const keyOrderRef = useRef(new Map());
  const nextOrderRef = useRef(1);

  const persistKeyRef = useRef(null);
  const savePersisted = useCallback(() => {
    const k = persistKeyRef.current;
    if (!k) return;
    try {
      const payload = {
        yellow: Array.from(yellowByKeyRef.current.entries()),
        red: Array.from(redByKeyRef.current.values()),
        order: Array.from(keyOrderRef.current.entries()),
      };
      localStorage.setItem(k, JSON.stringify(payload));
    } catch {}
  }, []);

  const loadPersisted = useCallback((k) => {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return;
      const obj = JSON.parse(raw);
      yellowByKeyRef.current = new Map(obj?.yellow || []);
      redByKeyRef.current = new Set(obj?.red || []);
      keyOrderRef.current = new Map(obj?.order || []);

      let max = 0;
      for (const val of keyOrderRef.current.values()) {
        if (typeof val === "number" && val > max) max = val;
      }
      nextOrderRef.current = max + 1;
    } catch {}
  }, []);

  const clearPersisted = useCallback(() => {
    const k = persistKeyRef.current;
    if (!k) return;
    try {
      localStorage.removeItem(k);
    } catch {}
  }, []);

  const enablePersistence = useCallback((meetingKey = "default") => {
    const k = `cards:${String(meetingKey)}`;
    persistKeyRef.current = k;
    loadPersisted(k);
    callbacks?.onScoreboardUpdate?.(buildScoreboard());
  }, [callbacks, loadPersisted]);

  const { onScoreboardUpdate, onYellow, onSendNotice, onUserExpelled } = callbacks || {};

  const getNiceName = useCallback(
    (u) => u?.displayName || u?.userName || u?.name || u?.email || "Usuario",
    []
  );

  const rawKeyFromUser = useCallback(
    (u) =>
      u?.userGuid ||
      u?.userGUID ||
      u?.email ||
      u?.userEmail ||
      u?.userName ||
      u?.displayName ||
      u?.name ||
      u?.userId,
    []
  );

  const resolveKey = useCallback(
    (u) => {
      if (!u) return null;
      const name = getNiceName(u);
      const existing = nameToKeyRef.current.get(name);
      return existing || rawKeyFromUser(u);
    },
    [getNiceName, rawKeyFromUser]
  );

  const touchUserMapping = useCallback(
    (u) => {
      if (!u) return;
      const name = getNiceName(u);
      let key = resolveKey(u);
      if (!key) return;

      const prevForName = nameToKeyRef.current.get(name);
      if (prevForName && prevForName !== key) {
        key = prevForName;
      }
      nameToKeyRef.current.set(name, key);

      if (u?.userId != null) {
        userIdToKeyRef.current.set(u.userId, key);
        keyToLastUserIdRef.current.set(key, u.userId);
      }

      if (!keyOrderRef.current.has(key)) {
        keyOrderRef.current.set(key, nextOrderRef.current++);
      }
    },
    [getNiceName, resolveKey]
  );

  const isRed = useCallback((key) => redByKeyRef.current.has(key), []);

  const getYellowByUserId = useCallback(() => {
    const out = new Map();
    const client = clientRef.current;
    if (!client) return out;

    const list = client.getAllUser?.() || client.getAttendeeslist?.() || [];

    for (const p of list) {
      touchUserMapping(p);
      const key = userIdToKeyRef.current.get(p.userId) || resolveKey(p);
      const cnt = yellowByKeyRef.current.get(key) || 0;
      if (cnt > 0) out.set(p.userId, cnt);
    }
    return out;
  }, [clientRef, resolveKey, touchUserMapping]);

  const getYellowedUserIds = useCallback(
    () => Array.from(getYellowByUserId().keys()),
    [getYellowByUserId]
  );

  const yellowCountForUserId = useCallback(
    (userId) => {
      const key = userIdToKeyRef.current.get(userId);
      if (!key) return 0;
      return yellowByKeyRef.current.get(key) || 0;
    },
    []
  );

  const buildScoreboard = useCallback(() => {
    const now = Date.now();
    const base = Array.from(nameToKeyRef.current.entries()).map(([name, key]) => {
      const seen = lastSeenAtRef.current.get(key) || 0;
      const status = now - seen < ACTIVE_WINDOW_MS ? "Activo" : "Fuera";
      const order = keyOrderRef.current.get(key) ?? Number.MAX_SAFE_INTEGER;
      return {
        id: key,
        name,
        cam: "N/D",
        yellows: yellowByKeyRef.current.get(key) || 0,
        red: redByKeyRef.current.has(key),
        status,
        order,
      };
    });

    return base.sort((a, b) => {
      const redDiff = Number(b.red) - Number(a.red);
      if (redDiff !== 0) return redDiff;
      const yellowDiff = b.yellows - a.yellows;
      if (yellowDiff !== 0) return yellowDiff;
      return a.order - b.order;
    });
  }, []);

  const markSeen = useCallback((u) => {
    if (!u) return;
    touchUserMapping(u);
    const key = resolveKey(u);
    if (!key) return;
    lastSeenAtRef.current.set(key, Date.now());
  }, [resolveKey, touchUserMapping]);

  const updatePresence = useCallback((roster = []) => {
    for (const u of roster) markSeen(u);
    onScoreboardUpdate?.(buildScoreboard());
  }, [markSeen, onScoreboardUpdate, buildScoreboard]);

  const markLeft = useCallback((u) => {
    if (!u) return;
    const key = resolveKey(u);
    if (!key) return;
    lastSeenAtRef.current.set(key, 0);
    onScoreboardUpdate?.(buildScoreboard());
  }, [resolveKey, onScoreboardUpdate, buildScoreboard]);

  const escalateToRed = useCallback(async (user) => {
    if (!user) return;
    touchUserMapping(user);
    const key = resolveKey(user);
    if (!key) return;

    redByKeyRef.current.add(key);
    savePersisted();
    await onSendNotice?.("red", user);

    const uid = keyToLastUserIdRef.current.get(key) || user?.userId;
    try { await clientRef.current?.expel?.(uid); } catch {}
    try { await clientRef.current?.putOnHold?.(uid, true); } catch {}

    if (uid) onUserExpelled?.(uid);
    onScoreboardUpdate?.(buildScoreboard());
  }, [resolveKey, touchUserMapping, onSendNotice, onUserExpelled, onScoreboardUpdate, buildScoreboard, clientRef, savePersisted]);

  const addYellow = useCallback(async (user) => {
    if (!user) return;
    touchUserMapping(user);
    const key = resolveKey(user);
    if (!key) return;

    const now = Date.now();
    const last = lastYellowAtRef.current.get(key) || 0;
    if (now - last < COOLDOWN_MS) return;
    lastYellowAtRef.current.set(key, now);

    const prev = yellowByKeyRef.current.get(key) || 0;
    const next = prev + 1;
    yellowByKeyRef.current.set(key, next);
    savePersisted();

    await onSendNotice?.("yellow", user, next);
    onYellow?.({ key, count: next });
    onScoreboardUpdate?.(buildScoreboard());

    if (next >= MAX_YELLOWS) {
      await escalateToRed(user);
    }
  }, [resolveKey, getNiceName, touchUserMapping, onSendNotice, onScoreboardUpdate, buildScoreboard, escalateToRed, savePersisted, onYellow]);

  const putOnHoldWithCards = useCallback(async (user) => {
    if (!user || user.isHost || user.isCohost) return;
    touchUserMapping(user);
    const key = resolveKey(user);
    const uid = keyToLastUserIdRef.current.get(key) || user?.userId;
    if (!uid || !key) return;

    if (inFlightRef.current.has(key)) return;
    inFlightRef.current.add(key);

    try {
      if (isRed(key)) {
        try {
          await clientRef.current?.putOnHold?.(uid, true);
          await onSendNotice?.("red", user);
        } catch {
        } finally {
          onScoreboardUpdate?.(buildScoreboard());
        }
        return;
      }

      let holdOk = false;
      try {
        await clientRef.current?.putOnHold?.(uid, true);
        holdOk = true;
      } catch {}

      if (holdOk) {
        await addYellow(user);
        await onSendNotice?.("info", user);
        onScoreboardUpdate?.(buildScoreboard());
      }
    } finally {
      inFlightRef.current.delete(key);
    }
  }, [resolveKey, getNiceName, touchUserMapping, isRed, clientRef, addYellow, onSendNotice, onScoreboardUpdate, buildScoreboard]);

  const getScoreboard = useCallback((roster = []) => {
    const base =
      Array.isArray(roster) && roster.length > 0
        ? roster
        : Array.from(nameToKeyRef.current.entries()).map(([name, key]) => ({
            id: key,
            displayName: name,
            userId: keyToLastUserIdRef.current.get(key),
            bVideoOn: undefined,
          }));

    const rows = base
      .filter((u) => !u.isHost && !u.isCohost)
      .map((u) => {
        touchUserMapping(u);
        const key = resolveKey(u);
        const order = keyOrderRef.current.get(key) ?? Number.MAX_SAFE_INTEGER;
        return {
          id: key,
          name: getNiceName(u),
          cam: u?.bVideoOn === true ? "ON" : u?.bVideoOn === false ? "OFF" : "N/D",
          yellows: yellowByKeyRef.current.get(key) || 0,
          red: redByKeyRef.current.has(key),
          order,
        };
      })
      .sort((a, b) => {
        const redDiff = Number(b.red) - Number(a.red);
        if (redDiff !== 0) return redDiff;
        const yellowDiff = b.yellows - a.yellows;
        if (yellowDiff !== 0) return yellowDiff;
        return a.order - b.order;
      });

    return rows;
  }, [resolveKey, getNiceName, touchUserMapping]);

  const resetCards = useCallback(() => {
    yellowByKeyRef.current.clear();
    redByKeyRef.current.clear();
    lastYellowAtRef.current.clear();
    savePersisted();
    onScoreboardUpdate?.(buildScoreboard());
  }, [onScoreboardUpdate, buildScoreboard, savePersisted]);

  return {
    addYellow,
    escalateToRed,
    putOnHoldWithCards,
    resetCards,
    getScoreboard,
    getSnapshot: buildScoreboard,
    updatePresence,
    markSeen,
    markLeft,
    getYellowByUserId,
    getYellowedUserIds,
    yellowCountForUserId,
    enablePersistence,
    clearPersisted,
    isRed,
    yellowByKey: yellowByKeyRef.current,
    redByKey: redByKeyRef.current,
    nameToKeyRef: nameToKeyRef.current,
    keyToLastUserIdRef: keyToLastUserIdRef.current,
  };
};