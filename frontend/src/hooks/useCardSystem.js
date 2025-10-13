import React, { useRef, useCallback } from 'react';


const MAX_YELLOWS = 3;
const COOLDOWN_MS = 4000; // ventana para ignorar duplicados
const ACTIVE_WINDOW_MS = 30_000; // dentro de esto lo consideramos Activo


export const useCardSystem = (clientRef, callbacks = {}) => {
  const yellowByKeyRef = useRef(new Map());   // key -> count
  const redByKeyRef = useRef(new Set());      // set(keys)
  const nameToKeyRef = useRef(new Map());     // displayName -> key
  const keyToLastUserIdRef = useRef(new Map());// key -> last userId visto
   const inFlightRef = useRef(new Set());     // keys procesandose
  const lastYellowAtRef = useRef(new Map()); // key -> timestamp ultima amarilla
  const lastSeenAtRef = useRef(new Map()); // key -> timestamp ultimo visto

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
  []);

  const getNiceName = useCallback((u) =>
    u?.displayName || u?.userName || u?.name || getUserKey(u) || "Usuario", [getUserKey]
  );

  const buildScoreboard = useCallback(() => {
   const now = Date.now();
  const base = Array.from(nameToKeyRef.current.entries()).map(([name, key]) => {
    const seen = lastSeenAtRef.current.get(key) || 0;
    const status = now - seen < ACTIVE_WINDOW_MS ? "Activo" : "Fuera";
    return {
      id: key,
      name,
      cam: "N/D",
      yellows: yellowByKeyRef.current.get(key) || 0,
      red: redByKeyRef.current.has(key),
      status, 
    };
  });
  return base.sort((a, b) => (Number(b.red) - Number(a.red)) || (b.yellows - a.yellows));
}, []);


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
  //anti-duplicado por tiempo 
  const now = Date.now();
  const last = lastYellowAtRef.current.get(key) || 0;
  if (now - last < COOLDOWN_MS) {
    console.log(`🟨 (skip) duplicate yellow for ${getNiceName(user)} within ${COOLDOWN_MS}ms`);
    return;
  }
  lastYellowAtRef.current.set(key, now);

  const prev = yellowByKeyRef.current.get(key) || 0;
  const next = prev + 1;
  yellowByKeyRef.current.set(key, next);

  console.log(`🟨 addYellow → ${getNiceName(user)} (${next})`);
  await onSendNotice?.("yellow", user, next);

  onScoreboardUpdate?.(buildScoreboard());

  if (next >= MAX_YELLOWS) {
    await escalateToRed(user);
  }
}, [getUserKey, getNiceName, touchUserMapping, onSendNotice, onScoreboardUpdate, buildScoreboard]);

const markSeen = useCallback((u) => {
  if (!u) return;
  const key = getUserKey(u) || nameToKeyRef.current.get(getNiceName(u));
  if (!key) return;
  touchUserMapping(u);
  lastSeenAtRef.current.set(key, Date.now());
}, [getUserKey, getNiceName, touchUserMapping]);

const updatePresence = useCallback((roster = []) => {
  for (const u of roster) markSeen(u);
  // dispara un refresh del snapshot
  onScoreboardUpdate?.(buildScoreboard());
}, [markSeen, onScoreboardUpdate, buildScoreboard]);

const markLeft = useCallback((u) => {
  if (!u) return;
  const key = getUserKey(u) || nameToKeyRef.current.get(getNiceName(u));
  if (!key) return;
  // Forzamos a "Fuera" poniendo un lastSeen viejo
  lastSeenAtRef.current.set(key, 0);
  onScoreboardUpdate?.(buildScoreboard());
}, [getUserKey, getNiceName, onScoreboardUpdate, buildScoreboard]);




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
   onScoreboardUpdate?.(buildScoreboard());
  }, [getUserKey, getNiceName, touchUserMapping, onSendNotice, onUserExpelled, onScoreboardUpdate, clientRef]);

 const putOnHoldWithCards = useCallback(async (user) => {
  if (!user || user.isHost || user.isCohost) return;

  touchUserMapping(user);
  const key = getUserKey(user) || nameToKeyRef.current.get(getNiceName(user));
  const uid = keyToLastUserIdRef.current.get(key) || user?.userId;
  if (!uid || !key) return;

  //  si ya hay una accion en vuelo para este key, no repetir
  if (inFlightRef.current.has(key)) {
    console.log(`⏭️ (skip) action in-flight for ${getNiceName(user)}`);
    return;
  }
  inFlightRef.current.add(key);

  try {
    if (isRed(key)) {
      try {
        await clientRef.current?.putOnHold?.(uid, true);
        await onSendNotice?.("red", user);
      } catch (err) {
        console.error("❌ Error putOnHold (red):", err);
      } finally {
        onScoreboardUpdate?.(buildScoreboard());
      }
      return;
    }

    try {
      await clientRef.current?.putOnHold?.(uid, true);
    } catch (err) {
      console.warn("⚠️ No se pudo poner en espera:", err?.message || err);
    }

    await addYellow(user);         
    await onSendNotice?.("info", user);
    onScoreboardUpdate?.(buildScoreboard());

  } finally {
    // liberamos el lock aunque haya errores
    inFlightRef.current.delete(key);
  }
}, [getUserKey, getNiceName, touchUserMapping, isRed, clientRef, addYellow, onSendNotice, onScoreboardUpdate, buildScoreboard]);


   const getScoreboard = useCallback((roster = []) => {
     const base =
     Array.isArray(roster) && roster.length > 0
       ? roster
       : // construir desde lo que sabemos en memoria
         Array.from(nameToKeyRef.current.entries()).map(([name, key]) => ({
           id: key,
           displayName: name,
           userId: keyToLastUserIdRef.current.get(key),
           bVideoOn: undefined,
         }));

      const rows = base
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
  lastYellowAtRef.current.clear();//limpia cooldown
  onScoreboardUpdate?.(buildScoreboard());
}, [onScoreboardUpdate, buildScoreboard]);


 return {
  addYellow,
  escalateToRed,
  putOnHoldWithCards,
  getScoreboard,      
  resetCards,
  isRed,
  getSnapshot: buildScoreboard,
  updatePresence, 
  markSeen,       
  markLeft,       
  yellowByKey: yellowByKeyRef.current,
  redByKey: redByKeyRef.current,
  nameToKeyRef: nameToKeyRef.current,
  keyToLastUserIdRef: keyToLastUserIdRef.current,
};

};
