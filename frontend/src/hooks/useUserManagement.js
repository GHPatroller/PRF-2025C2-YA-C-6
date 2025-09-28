import { useRef } from 'react';
import { zoomAPI } from "../services/zoomAPI";
import { useZoomEvents } from './useZoomEvents';
import { useWaitingRoom } from './useWaitingRoom';
import { useVideoControls } from './useVideoControl';
import { useMeetingActions } from './useMeetingActions';
import { findUserFromPayload } from '../utils/userUtils'

const GRACE_MS = 10_000;   // 10 seg gracia
const STABILIZE_MS = 1200; // delay para que bVideoOn se estabilice

export const useUserManagement = (clientRef, opts = {}) => {
  const { pauseCameraRule = false } = opts; 
  const waitingRoom = useWaitingRoom();

  // Referencia para pausar la regla (RECREO)
  const pausedRef = useRef(false);

  const meetingActions = useMeetingActions(clientRef, {
    onUserAdmitted: (user) => {
      console.log('✅ Admitido desde Waiting Room');
      waitingRoom.removeWaitingUser(user.userId || user.userGUID);
      videoControls.clearUserState(user.userId);
    },
    onUserHeld: (user) => {
      console.log(`🚪 ${user.displayName || user.userId} enviado a Waiting Room`);
    },
    onMeetingCreated: (meetingInfo) => {
      console.log('🎉 Reunión creada:', meetingInfo);
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
      setTimeout(() => {
        if (pausedRef.current) return;
        roster.forEach((u) => videoControls?.handleVideoState?.(u)); 
      }, STABILIZE_MS);
    },
    onUserUpdated: (items, roster) => {
      if (pausedRef.current) return;
      for (const it of items) {
        const user = findUserFromPayload(roster, it) || it;
        if (!user) continue;
        videoControls?.handleVideoState?.(user);
      }
    },
    onUserRemoved: (items) => {
      for (const it of items) {
        const u = findUserFromPayload([], it) || it;
        if (u?.userId) {
          videoControls?.clearUserState?.(u.userId);
        }
      }
    },
    onPoll: (roster) => {
      if (pausedRef.current) return;
      for (const u of roster) videoControls?.handleVideoState?.(u);
    }
  });

  const videoControls = useVideoControls(clientRef, getRoster, {
    onHoldUser: (user) => {
      console.log(`🚪 ${user.displayName || user.userId} a Waiting Room`);
    },
    onClearTimers: (userId) => {
      videoControls.clearUserState(userId);
    },
    onStabilized: (user) => {
      if (pausedRef.current) return;
      videoControls.handleVideoState(user);
    },
    onGraceEnd: async (user) => {
      if (pausedRef.current) return;
      if (user?.bVideoOn === false) {
        await videoControls.putOnHold(user);
        console.log(`⏱️ Grace agotado (${GRACE_MS / 1000}s) para ${user.displayName || user.userId}`);
      } else {
        console.log(`✅ ${user?.displayName || user.userId} encendió cámara a tiempo`);
        videoControls.clearUserState(user.userId);
      }
    },
    onPutOnHold: meetingActions.sendToWaitingRoom,
    // AÑADIR callback para pausar/reanudar
    onPauseStateChange: (paused) => {
      pausedRef.current = paused;
      if (paused) {
        console.log("⏸️ Regla de cámara pausada (RECREO)");
      } else {
        console.log("▶️ Regla de cámara reanudada");
      }
    }
  });

  // Efecto para manejar el RECREO
  React.useEffect(() => {
    videoControls?.setPaused?.(pauseCameraRule);
  }, [pauseCameraRule, videoControls]);

  const updatedMeetingActions = useMeetingActions(clientRef, {
    onUserAdmitted: (user) => {
      console.log('✅ Admitido desde Waiting Room');
      waitingRoom.removeWaitingUser(user.userId || user.userGUID);
      videoControls.clearUserState(user.userId);
    },
    onUserHeld: (user) => {
      console.log(`🚪 ${user.displayName || user.userId} enviado a Waiting Room`);
    },
    onMeetingCreated: (meetingInfo) => {
      console.log('🎉 Reunión creada:', meetingInfo);
    }
  });

  // acciones del host
  const createAndJoinMeeting = updatedMeetingActions.createAndJoinMeeting;

  const admitOnHold = async () => {
    const client = clientRef?.current;
    if (!client) return;
    if (!waitingRoom.waitingUsers.length) return console.log('❌ Sin usuarios en espera');

    const userToAdmit = waitingRoom.admitFirstWaitingUser();
    if (!userToAdmit) return console.log('❌ No hay usuario para admitir');
    const guidOrId = userToAdmit.userGuid || userToAdmit.userGUID || userToAdmit.userId;
    if (!guidOrId) return console.log('❌ Falta userGuid/userId para admitir');

    try {
      await client.admit(guidOrId);
      console.log('✅ Admitido desde Waiting Room');

      if (userToAdmit.userId) {
        videoControls.clearUserState(userToAdmit.userId);
      } else {
        setTimeout(() => {
          const u = getRoster().find(
            (x) =>
              x.userGUID === userToAdmit.userGUID ||
              x.userGuid === userToAdmit.userGuid
          );
          if (u?.userId) {
            videoControls.clearUserState(u.userId); 
          }
        }, 800);
      }
    } catch (err) {
      console.error('❌ Error admit:', err);
    }
  };

  const sendToOnHold = async () => {
    const client = clientRef?.current;
    if (!client) return;

    const attendees = getRoster();
    const target = attendees.find((a) => !a.isHost && !a.isCohost) || attendees[0];
    if (!target?.userId) return console.log('❌ No hay participante válido');

    await videoControls.putOnHold(target); 
  };

  return {
    waitingUsers: waitingRoom.waitingUsers,
    createAndJoinMeeting,
    admitOnHold,
    sendToOnHold,
    handleVideoState: videoControls.handleVideoState
  };
};