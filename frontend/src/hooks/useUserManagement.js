import { useRef, useEffect, useState } from 'react';
import { zoomAPI } from "../services/zoomAPI";
import { useZoomEvents } from './useZoomEvents';
import { useWaitingRoom } from './useWaitingRoom';
import { useVideoControls } from './useVideoControl';
import { useMeetingActions } from './useMeetingActions';
import { findUserFromPayload } from '../utils/userUtils'
import { useCardSystem } from './useCardSystem';

const GRACE_MS = 10_000;   // 10 seg gracia
const STABILIZE_MS = 1200; // delay para que bVideoOn se estabilice

export const useUserManagement = (clientRef, opts = {}) => {
  const { pauseCameraRule = false } = opts; 
  const waitingRoom = useWaitingRoom();
  const [scoreboard, setScoreboard] = useState([]);
  // RECREO
  const pausedRef = useRef(false);
 const meetingActions = useMeetingActions(clientRef, {
    onUserAdmitted: (user) => {
      console.log('✅ Admitido desde Waiting Room');
      waitingRoom.removeWaitingUser(user.userId || user.userGUID);
      videoControls.clearUserState(user.userId);
     cardSystem.updatePresence(getRoster());
    },
    onUserHeld: (user) => {
      console.log(` ${user.displayName || user.userId} enviado a Waiting Room`);
     cardSystem.updatePresence(getRoster());
    },
    onMeetingCreated: (meetingInfo) => {
      console.log('Reunión creada:', meetingInfo);
      cardSystem.updatePresence(getRoster());
    }
  });  

  const { getRoster } = useZoomEvents(clientRef, {
    onUserJoinWaiting: (users) => {
      if (pausedRef.current) return;
      waitingRoom.addWaitingUsers(users);
      console.log('⏳ Waiting Room:', users);
    },

    onUserAdded: (items, roster) => {
      console.log('👤 Entró usuario(s):', items);
      if (pausedRef.current) return;
      
      for (const it of items) {
        const user = findUserFromPayload(roster, it);
        if (user) videoControls?.handleVideoState?.(user);
      }

      // Damos un pequeño margen a que el SDK estabilice bVideoOn
      setTimeout(() => {
        if (pausedRef.current) return;
        roster.forEach((u) => videoControls?.handleVideoState?.(u)); 
        cardSystem.updatePresence(getRoster());
      }, STABILIZE_MS);
    },

    onUserUpdated: (items, roster) => {
      if (pausedRef.current) return;
      for (const it of items) {
        const user = findUserFromPayload(roster, it) || it;
        if (!user) continue;
        videoControls?.handleVideoState?.(user);
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
      if (pausedRef.current) return;
      for (const u of roster) videoControls?.handleVideoState?.(u);
      cardSystem.updatePresence(roster);
    }
  });
  


const cardSystemRef = useRef(null);

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



const cardSystem = useCardSystem(clientRef, {
  onSendNotice: async (type, user, count) => {
    console.log(`Notificación ${type} para ${user.displayName}`, count ? `(x${count})` : "");
  },
  onUserExpelled: (userId) => {
    videoControls.clearUserState(userId);
  },
  // 👇 Recibe las filas ya construidas desde CardSystem
  onScoreboardUpdate: (rows) => {
    setScoreboard(Array.isArray(rows) ? rows : []);
  },
});

cardSystemRef.current = cardSystem;


  

  const videoControls = useVideoControls(clientRef, getRoster, {
    onHoldUser: (user) => {
      console.log(` ${user.displayName || user.userId} a Waiting Room`);
      cardSystem.putOnHoldWithCards(user);
    },
    onClearTimers: (userId) => {
      videoControls.clearUserState(userId);
    },
    onStabilized: (user) => {
      if (pausedRef.current) return;
      videoControls.handleVideoState(user);
      cardSystem.updatePresence(getRoster());
    },
    onGraceEnd: async (user) => {
      if (pausedRef.current) return;
      if (user?.bVideoOn === false) {
        await cardSystem.putOnHoldWithCards(user);
        console.log(`⏱️ Grace agotado (${GRACE_MS / 1000}s) para ${user.displayName || user.userId}`);
      } else {
        console.log(`✅ ${user?.displayName || user.userId} encendió cámara a tiempo`);
        videoControls.clearUserState(user.userId);
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

  

  // Efecto para manejar el RECREO desde prop externa
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
  try {
    localStorage.setItem('scoreboard', JSON.stringify(scoreboard));
    // Dispara un evento manual por si la otra pestaña quiere reaccionar
    window.dispatchEvent(new Event('scoreboard-updated'));
  } catch (e) {
    console.warn('No se pudo persistir scoreboard', e);
  }

}, [scoreboard]);
  useEffect(() => {
    cardSystem.updatePresence(getRoster());
  }, [clientRef]); 

  
const recordYellow = (user) => {
  if (!user) return;
  setScoreboard((prev) => {
    const next = Array.isArray(prev) ? [...prev] : [];
    const id = user.userId ?? user.id ?? user.uid ?? user.participantId;
    const name = user.displayName ?? user.name ?? user.userName ?? "Desconocido";

    let i = next.findIndex(r => r.id === id);
    if (i === -1) {
      next.push({
        id,
        name,
        cam: user.bVideoOn ? "ON" : "OFF",
        yellows: 0,
        red: false,
        points: 0,
        lastEvent: null,
      });
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


  // acciones del host
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
