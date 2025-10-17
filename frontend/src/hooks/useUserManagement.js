import { useRef, useEffect, useState } from 'react';
import { zoomAPI } from "../services/zoomAPI";
import { useZoomEvents } from './useZoomEvents';
import { useWaitingRoom } from './useWaitingRoom';
import { useVideoControls } from './useVideoControl';
import { useMeetingActions } from './useMeetingActions';
import { findUserFromPayload } from '../utils/userUtils';
import { useCardSystem } from './useCardSystem';

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

  // 🔹 useZoomEvents
  const { getRoster } = useZoomEvents(clientRef, {
    onUserJoinWaiting: (users) => {
      // La waiting room no depende de las reglas de cámara/mic
      waitingRoom.addWaitingUsers(users);
      users.forEach(u => videoControls.clearUserState?.(u.userId));
      console.log('⏳ Waiting Room:', users);
    },

    onUserAdded: (items, roster) => {
      console.log('👤 Entró usuario(s):', items);
      for (const it of items) {
        const user = findUserFromPayload(roster, it);
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

  // 🔹 Card System
  const cardSystemRef = useRef(null);
  const cardSystem = useCardSystem(clientRef, {
    onSendNotice: async () => {},
    onUserExpelled: (userId) => videoControls.clearUserState(userId),
    onScoreboardUpdate: (rows) => setScoreboard(Array.isArray(rows) ? rows : []),
  });
  cardSystemRef.current = cardSystem;

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

  // 🔹 Meeting Actions
  const meetingActions = useMeetingActions(clientRef, {
    onUserAdmitted: (user) => {
      console.log('✅ Admitido desde Waiting Room');
      waitingRoom.removeWaitingUser(user.userId || user.userGUID);
      videoControls.clearUserState(user.userId);
      cardSystem.updatePresence(getRoster());
    },
    onUserHeld: (user) => {
      console.log(` ${user.displayName || user.userId} enviado a Waiting Room`);
      videoControls.clearUserState?.(user.userId);
      cardSystem.updatePresence(getRoster());
    },
    onMeetingCreated: (info) => {
      console.log('Reunión creada:', info);
      cardSystem.updatePresence(getRoster());
    }
  });

  // 🔹 Video Controls
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

  // 🔹 Efectos
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

  // 🔹 Otras funciones
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

  // 🔹 Meeting actions
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
    addYellow: cardSystem.addYellow,
    resetCards: cardSystem.resetCards,
    cardSystem,
    scoreboard,
    recordYellow
  };
};
