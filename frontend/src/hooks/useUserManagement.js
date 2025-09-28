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
      // Refrescamos la tabla tras cambios de admisión
      setScoreboard(cardSystem.getScoreboard(getRoster()));
    },
    onUserHeld: (user) => {
      console.log(`🚪 ${user.displayName || user.userId} enviado a Waiting Room`);
      // También refrescamos
      setScoreboard(cardSystem.getScoreboard(getRoster()));
    },
    onMeetingCreated: (meetingInfo) => {
      console.log('🎉 Reunión creada:', meetingInfo);
      // Inicial del scoreboard por si ya hay roster
      setScoreboard(cardSystem.getScoreboard(getRoster()));
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
        // ✅ Refrescamos la tabla luego de estabilizar
        setScoreboard(cardSystem.getScoreboard(getRoster()));
      }, STABILIZE_MS);
    },

    onUserUpdated: (items, roster) => {
      if (pausedRef.current) return;
      for (const it of items) {
        const user = findUserFromPayload(roster, it) || it;
        if (!user) continue;
        videoControls?.handleVideoState?.(user);
      }
      // ✅ Cada update refleja en la UI
      setScoreboard(cardSystem.getScoreboard(getRoster()));
    },

    onUserRemoved: (items) => {
      for (const it of items) {
        const u = findUserFromPayload([], it) || it;
        if (u?.userId) {
          videoControls?.clearUserState?.(u.userId);
        }
      }
      // ✅ Si se fue alguien, actualizamos la tabla
      setScoreboard(cardSystem.getScoreboard(getRoster()));
    },

    onPoll: (roster) => {
      if (pausedRef.current) return;
      for (const u of roster) videoControls?.handleVideoState?.(u);
      // ✅ Cada tick del poll recalcula el scoreboard con el roster “fresco”
      setScoreboard(cardSystem.getScoreboard(roster));
    }
  });

  const cardSystem = useCardSystem(clientRef, {
    onSendNotice: async (type, user, count) => {
      console.log(`📢 Notificación ${type} para ${user.displayName}`, count ? `(x${count})` : '');
    },
    onUserExpelled: (userId) => {
      videoControls.clearUserState(userId);
    },
    onScoreboardUpdate: () => {
      const roster = getRoster();
      console.log('📊 Scoreboard actualizado');
      // ✅ Cuando el sistema de tarjetas cambie algo (amarilla/roja/hold),
      //    recalculamos a partir del roster actual
      setScoreboard(cardSystem.getScoreboard(roster));
    }
  });

  const videoControls = useVideoControls(clientRef, getRoster, {
    onHoldUser: (user) => {
      console.log(`🚪 ${user.displayName || user.userId} a Waiting Room`);
      cardSystem.putOnHoldWithCards(user);
      // El onScoreboardUpdate de cardSystem ya refresca, pero por las dudas:
      setScoreboard(cardSystem.getScoreboard(getRoster()));
    },
    onClearTimers: (userId) => {
      videoControls.clearUserState(userId);
    },
    onStabilized: (user) => {
      if (pausedRef.current) return;
      videoControls.handleVideoState(user);
      setScoreboard(cardSystem.getScoreboard(getRoster()));
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
      setScoreboard(cardSystem.getScoreboard(getRoster()));
    },
    onPutOnHold: cardSystem.putOnHoldWithCards,
    onPauseStateChange: (paused) => {
      pausedRef.current = paused;
      if (paused) {
        console.log("⏸️ Regla de cámara pausada (RECREO)");
      } else {
        console.log("▶️ Regla de cámara reanudada");
        // Al reanudar, recalculamos todo
        setScoreboard(cardSystem.getScoreboard(getRoster()));
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
      setScoreboard(cardSystem.getScoreboard(getRoster()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauseCameraRule]);

  // Inicial del scoreboard cuando tengamos acceso al roster/cliente
  useEffect(() => {
    setScoreboard(cardSystem.getScoreboard(getRoster()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientRef]); 

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
    setScoreboard(cardSystem.getScoreboard(getRoster()));
  };

  const sendToOnHold = async () => {
    const attendees = getRoster();
    const target = attendees.find((a) => !a.isHost && !a.isCohost) || attendees[0];
    if (!target?.userId) {
      console.log('❌ No hay participante válido');
      return;
    }
    await meetingActions.sendToWaitingRoom(target);
    setScoreboard(cardSystem.getScoreboard(getRoster()));
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
    scoreboard
  };
};
