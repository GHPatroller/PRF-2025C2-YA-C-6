import { useRef, useEffect, useState } from 'react';
import { zoomAPI } from "../services/zoomAPI";
import { useZoomEvents } from './useZoomEvents';
import { useWaitingRoom } from './useWaitingRoom';
import { useVideoControls } from './useVideoControl';
import { useMeetingActions } from './useMeetingActions';
import { findUserFromPayload } from '../utils/userUtils';
import { useCardSystem } from './useCardSystem';
import { sendPrivateChat } from '../utils/chatUtils'; // ⬅️ NUEVO

const GRACE_MS = 10_000;
const STABILIZE_MS = 1200; // delay para estabilizar bVideoOn

export const useUserManagement = (clientRef, opts = {}) => {
  const { pauseCameraRule = false, pauseMicRule = false } = opts;
  const waitingRoom = useWaitingRoom();
  const [scoreboard, setScoreboard] = useState([]);
  const pausedRef = useRef(false);      // pausa cámara
  const pausedRefMic = useRef(false);   // pausa micrófono

  const camActive = () => !pausedRef.current;
  const micActive = () => !pausedRefMic.current;

  // -----------------------------
  // Card System (PRIMERO)
  // -----------------------------
  const cardSystemRef = useRef(null);

  // Helper local para notificar amarilla por DM
  const notifyYellow = async (userId, count, { rejoin = false } = {}) => {
    if (!userId || count <= 0) return;
    const base = `⚠️ Tienes ${count} tarjeta(s) amarilla(s). Enciende la cámara para evitar sanciones.`;
    const suffix = rejoin ? ' (reingreso)' : '';
    await sendPrivateChat(clientRef, userId, `${base}${suffix}`);
  };

  const cardSystem = useCardSystem(clientRef, {
    onSendNotice: async () => {},
    onUserExpelled: (userId) => videoControls?.clearUserState?.(userId),
    onScoreboardUpdate: (rows) => setScoreboard(Array.isArray(rows) ? rows : []),
    // Si tu useCardSystem dispara esto, mandamos DM inmediato
    onYellow: ({ key, count }) => {
      try {
        const userId = cardSystemRef.current?.keyToLastUserIdRef?.get(key);
        if (userId) notifyYellow(userId, count);
      } catch (e) {
        console.warn('onYellow->notify error', e);
      }
    },
  });
  cardSystemRef.current = cardSystem;

  // Wrapper para addYellow: asegura DM incluso si onYellow no está cableado adentro
  const addYellow = (target) => {
    try {
      // Invocamos la amarilla del sistema
      cardSystem.addYellow?.(target);

      // Resolución de key y userId para notificar
      let userId = null;
      let key = null;

      if (target && typeof target === 'object') {
        userId = target.userId ?? target.id ?? target.uid ?? target.participantId ?? null;
        const displayName = target.displayName ?? target.name ?? target.userName;
        key = cardSystem.nameToKeyRef?.get(displayName) || displayName || null;
      }

      // Si no vino objeto (ej. string key), intentamos usarlo como key
      if (!key && typeof target === 'string') key = target;

      // Si no tengo userId, intento desde el mapa key->lastUserId
      if (!userId && key) {
        userId = cardSystem.keyToLastUserIdRef?.get(key) ?? null;
      }

      // Obtenemos el conteo final tras sumar
      const count =
        (key && cardSystem.yellowByKey?.get(key)) ??
        0;

      if (userId && count > 0) {
        notifyYellow(userId, count);
      }
    } catch (e) {
      console.warn('addYellow wrapper error', e);
    }
  };

  const rebuildScoreboard = () => {
    try {
      const roster =
        clientRef.current?.getAllUser?.() ||
        clientRef.current?.getAttendeeslist?.() ||
        getRoster?.() ||
        [];
      const board = cardSystemRef.current?.getScoreboard
        ? cardSystemRef.current.getScoreboard(roster)
        : [];
      setScoreboard(board);
    } catch (e) {
      console.warn("⚠️ Error rebuildScoreboard:", e);
    }
  };

  // -----------------------------
  // Zoom Events (DESPUÉS de cardSystem)
  // -----------------------------
  const { getRoster } = useZoomEvents(clientRef, {
    onUserJoinWaiting: (users) => {
      // La waiting room no depende de las reglas de cámara/mic
      waitingRoom.addWaitingUsers(users);
      users.forEach(u => videoControls?.clearUserState?.(u.userId));
      console.log('⏳ Waiting Room:', users);
    },

    onUserAdded: (items, roster) => {
      console.log('👤 Entró usuario(s):', items);
      for (const it of items) {
        const user = findUserFromPayload(roster, it) || it;
        if (!user) continue;

        // Mapeo key -> último userId visto (para poder DMs confiables)
        try {
          const displayName = user.displayName ?? user.name ?? user.userName;
          if (displayName && user.userId) {
            const key = cardSystem.nameToKeyRef?.get(displayName) || displayName;
            cardSystem.keyToLastUserIdRef?.set(key, user.userId);

            // Si tenía amarillas previas en esta sesión, reenviamos DM
            const prevCount = cardSystem.yellowByKey?.get(key) ?? 0;
            if (prevCount > 0) {
              notifyYellow(user.userId, prevCount, { rejoin: true });
            }
          }
        } catch (e) {
          console.warn('onUserAdded->map key/userId error', e);
        }

        // Reaplicamos reglas
        if (user) {
          if (camActive()) videoControls?.handleVideoState?.(user, 'video');
          if (micActive()) videoControls?.handleAudioState?.(user, 'audio');
        }
      }

      setTimeout(() => {
        const fresh = getRoster();
        for (const u of fresh) {
          if (camActive()) videoControls?.handleVideoState?.(u, 'video');
          if (micActive()) videoControls?.handleAudioState?.(u, 'audio');
        }
        cardSystem.updatePresence(fresh);
      }, STABILIZE_MS);
    },

    onUserUpdated: (items, roster) => {
      for (const it of items) {
        const type = it?.__eventType || 'generic';
        const user = findUserFromPayload(roster, it) || it;
        if (!user) continue;

        if (type === 'audio') {
          if (micActive()) videoControls?.handleAudioState?.(user, 'audio');
        } else if (type === 'video') {
          if (camActive()) videoControls?.handleVideoState?.(user, 'video');
        } else {
          if (camActive()) videoControls?.handleVideoState?.(user, 'video');
          if (micActive()) videoControls?.handleAudioState?.(user, 'audio');
        }

        // Actualizamos key->userId si cambió
        try {
          const displayName = user.displayName ?? user.name ?? user.userName;
          if (displayName && user.userId) {
            const key = cardSystem.nameToKeyRef?.get(displayName) || displayName;
            cardSystem.keyToLastUserIdRef?.set(key, user.userId);
          }
        } catch {}
      }
      cardSystem.updatePresence(getRoster());
    },

    onUserRemoved: (items) => {
      for (const it of items) {
        const u = findUserFromPayload([], it) || it;
        if (u?.userId) {
          videoControls?.clearUserState?.(u.userId);
          cardSystem.markLeft?.(u);
        }
      }
    },

    onPoll: (roster) => {
      for (const u of roster) {
        if (camActive()) videoControls?.handleVideoState?.(u, 'video');
        if (micActive()) videoControls?.handleAudioState?.(u, 'audio');
      }
      cardSystem.updatePresence(roster);
    }
  });

  // -----------------------------
  // Meeting Actions
  // -----------------------------
  const meetingActions = useMeetingActions(clientRef, {
    onUserAdmitted: (user) => {
      console.log('✅ Admitido desde Waiting Room');
      waitingRoom.removeWaitingUser(user.userId || user.userGUID);
      videoControls?.clearUserState?.(user.userId);
      cardSystem.updatePresence(getRoster());
    },
    onUserHeld: (user) => {
      console.log(` ${user.displayName || user.userId} enviado a Waiting Room`);
      videoControls?.clearUserState?.(user.userId);
      cardSystem.updatePresence(getRoster());
    },
    onMeetingCreated: (info) => {
      console.log('Reunión creada:', info);
      cardSystem.updatePresence(getRoster());
    }
  });

  // -----------------------------
  // Video Controls
  // -----------------------------
  const videoControls = useVideoControls(clientRef, getRoster, {
    onHoldUser: (user) => {
      console.log(` ${user.displayName || user.userId} a Waiting Room`);
      cardSystem.putOnHoldWithCards(user);
    },
    onClearTimers: (userId) => videoControls.clearUserState(userId),
    onStabilized: (user) => {
      if (camActive()) videoControls.handleVideoState(user, 'video');
      if (micActive()) videoControls.handleAudioState(user, 'audio');
      cardSystem.updatePresence(getRoster());
    },
    onGraceEnd: async (user, reason) => {
      if (reason === 'cameraOff') {
        if (!camActive()) return; // cámara pausada => no sanciona
        if (user?.bVideoOn === false) {
          await cardSystem.putOnHoldWithCards(user);
          console.log(`⏱️ Grace agotado (${GRACE_MS / 1000}s) para ${user.displayName || user.userId}`);
        } else {
          console.log(`✅ ${user?.displayName || user.userId} encendió cámara a tiempo`);
          videoControls.clearUserState(user.userId);
        }
        return;
      }

      if (reason === 'micOff') {
        if (!micActive()) return;
        await cardSystem.putOnHoldWithCards(user);
        console.log(`⏱️ Grace agotado (${GRACE_MS / 1000}s) (mic OFF) para ${user.displayName || user.userId}`);
      }
    },
    onPutOnHold: cardSystem.putOnHoldWithCards,
    onPauseStateChange: (paused) => {
      pausedRef.current = paused;
      if (paused) {
        console.log("⏸️ Regla de cámara pausada (RECREO)");
      } else {
        console.log("▶️ Regla de cámara reanudada");
        cardSystem.updatePresence(getRoster());
      }
    }
  });

  // -----------------------------
  // Effects
  // -----------------------------
  useEffect(() => {
    pausedRef.current = pauseCameraRule;
    if (pauseCameraRule) {
      console.log("⏸️ Regla de cámara pausada (RECREO)");
    } else {
      console.log("▶️ Regla de cámara reanudada");
      cardSystem.updatePresence(getRoster());
    }
  }, [pauseCameraRule]);

  useEffect(() => {
    pausedRefMic.current = pauseMicRule;
    if (pauseMicRule) {
      console.log("⏸️ Regla de micrófono pausada (RECREO)");
    } else {
      console.log("▶️ Regla de micrófono reanudada");
      cardSystem.updatePresence(getRoster());
    }
  }, [pauseMicRule]);

  useEffect(() => {
    try {
      localStorage.setItem('scoreboard', JSON.stringify(scoreboard));
      window.dispatchEvent(new Event('scoreboard-updated'));
    } catch (e) {
      console.warn('No se pudo persistir scoreboard', e);
    }
  }, [scoreboard]);

  useEffect(() => {
    cardSystem.updatePresence(getRoster());
  }, [clientRef]);

  // -----------------------------
  // Funciones auxiliares
  // -----------------------------
  const recordYellow = (user) => {
    if (!user) return;
    setScoreboard((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      const id = user.userId ?? user.id ?? user.uid ?? user.participantId;
      const name = user.displayName ?? user.name ?? user.userName ?? "Desconocido";

      let i = next.findIndex(r => r.id === id);
      if (i === -1) {
        next.push({ id, name, cam: user.bVideoOn ? "ON" : "OFF", yellows: 0, red: false, points: 0, lastEvent: null });
        i = next.length - 1;
      }

      const row = { ...next[i] };
      row.yellows = (row.yellows ?? 0) + 1;
      row.points = (row.points ?? 0) + 1;
      row.lastEvent = `Yellow - ${new Date().toLocaleTimeString()}`;

      next[i] = row;
      return next;
    });
  };

  // -----------------------------
  // Meeting actions shortcuts
  // -----------------------------
  const createAndJoinMeeting = meetingActions.createAndJoinMeeting;

  const admitOnHold = async () => {
    if (!waitingRoom.waitingUsers.length) {
      console.log('❌ Sin usuarios en espera');
      return;
    }
    const userToAdmit = waitingRoom.admitFirstWaitingUser();
    if (!userToAdmit) {
      console.log('❌ No hay usuario para admitir');
      return;
    }
    await meetingActions.admitUser(userToAdmit);
    cardSystem.updatePresence(getRoster());
  };

  const sendToOnHold = async () => {
    const attendees = getRoster();
    const target = attendees.find((a) => !a.isHost && !a.isCohost) || attendees[0];
    if (!target?.userId) {
      console.log('❌ No hay participante válido');
      return;
    }
    await meetingActions.sendToWaitingRoom(target);
    cardSystem.updatePresence(getRoster());
  };

  return {
    waitingUsers: waitingRoom.waitingUsers,
    createAndJoinMeeting,
    admitOnHold,
    sendToOnHold,
    handleVideoState: videoControls.handleVideoState,
    getScoreboard: cardSystem.getScoreboard,
    addYellow,
    resetCards: cardSystem.resetCards,
    cardSystem,
    scoreboard,
    recordYellow
  };
};
