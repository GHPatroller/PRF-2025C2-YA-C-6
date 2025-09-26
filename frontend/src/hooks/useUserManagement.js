
import { useEffect, useRef, useState } from 'react';
import { zoomAPI } from "../services/zoomAPI";

const GRACE_MS = 10_000;   // 10 seg de gracia con cámara off
const STABILIZE_MS = 1200; // tiempo para estabilizar bVideoOn
const POLL_MS = 1000;      // frecuencia del poll del roster

export const useUserManagement = (clientRef, opts = {}) => {
  const { pauseCameraRule = false } = opts; 

  const [waitingUsers, setWaitingUsers] = useState([]);

  // Timers y estado por usuario
  const stabilizeTimersRef = useRef(new Map()); 
  const graceTimersRef = useRef(new Map());     
  const heldSetRef = useRef(new Set());         
  const pollRef = useRef(null);                

  const pausedRef = useRef(false);

  // Helpers
  const getRoster = () => clientRef?.current?.getAttendeeslist?.() || [];
  const toArray = (x) => (Array.isArray(x) ? x : [x].filter(Boolean));
  const isBool = (v) => typeof v === 'boolean';

  const findUserFromPayload = (payload) => {
    const roster = getRoster();
    return roster.find(
      (u) =>
        u.userId === payload?.userId ||
        u.userID === payload?.userID ||
        u.userGUID === payload?.userGUID ||
        u.userGuid === payload?.userGuid
    );
  };

  const clearStabilizeTimer = (userId) => {
    const t = stabilizeTimersRef.current.get(userId);
    if (t) clearTimeout(t);
    stabilizeTimersRef.current.delete(userId);
  };

  const clearGraceTimer = (userId) => {
    const t = graceTimersRef.current.get(userId);
    if (t) clearTimeout(t);
    graceTimersRef.current.delete(userId);
  };

  const clearAllTimers = (userId) => {
    clearStabilizeTimer(userId);
    clearGraceTimer(userId);
  };

  // Mandar a Waiting Room una sola vez
  const holdOnce = async (user) => {
    if (!user?.userId) return;
    if (user.isHost || user.isCohost) return;
    if (heldSetRef.current.has(user.userId)) return;

    try {
      await clientRef.current.putOnHold(user.userId, true);
      heldSetRef.current.add(user.userId);
      console.log(`🚪 ${user.displayName || user.userId} a Waiting Room`);
    } catch (err) {
      console.error('❌ Error putOnHold:', err);
    } finally {
      clearAllTimers(user.userId);
    }
  };

  const handleVideoState = (user) => {
    if (pausedRef.current) return; 
    if (!user || user.isHost || user.isCohost) return;

    if (user.bVideoOn === true) {
      clearAllTimers(user.userId);
      return;
    }

    if (!isBool(user.bVideoOn)) {
      // Estado indefinido -> esperar estabilización
      if (!stabilizeTimersRef.current.has(user.userId)) {
        const temp = setTimeout(() => {
          const fresh = getRoster().find((u) => u.userId === user.userId) || user;
          clearStabilizeTimer(user.userId);
          handleVideoState(fresh);
        }, STABILIZE_MS);

        stabilizeTimersRef.current.set(user.userId, temp);
        console.log(
          `⏳ Esperando estado cámara de ${user.displayName || user.userId} (${STABILIZE_MS}ms)`
        );
      }
      return;
    }

    // Cámara apagada con estado estable -> iniciar gracia
    if (!graceTimersRef.current.has(user.userId)) {
      const tid = setTimeout(async () => {
        if (pausedRef.current) return; 
        const fresh = getRoster().find((u) => u.userId === user.userId) || user;

        if (fresh?.bVideoOn === false) {
          await holdOnce(fresh);
          console.log(
            `⏱️ Grace agotado (${GRACE_MS / 1000}s) para ${fresh.displayName || fresh.userId}`
          );
        } else {
          console.log(`✅ ${fresh?.displayName || user.userId} encendió cámara a tiempo`);
          clearAllTimers(user.userId);
        }
      }, GRACE_MS);

      graceTimersRef.current.set(user.userId, tid);
      console.log(
        `⏳ Grace ${GRACE_MS / 1000}s para ${user.displayName || user.userId} (cámara OFF)`
      );
    }
  };

  // Suscripción a eventos + Poll del roster
  useEffect(() => {
    const client = clientRef?.current;
    if (!client) return;

    const onJoinWaiting = (payload) => {
      if (pausedRef.current) return;
      setWaitingUsers((prev) => [...prev, ...toArray(payload)]);
      console.log('⏳ Waiting Room:', payload);
    };

    const onUserAdded = (payload) => {
      const items = toArray(payload);
      console.log('👤 Entró usuario(s):', items);
      if (pausedRef.current) return;

      for (const it of items) {
        const user = findUserFromPayload(it);
        if (user) handleVideoState(user);
      }

      // Re-chequeo tras estabilizar por si el payload vino sin bVideoOn
      setTimeout(() => {
        if (pausedRef.current) return;
        getRoster().forEach((u) => handleVideoState(u));
      }, STABILIZE_MS);
    };

    const onUserUpdated = (payload) => {
      if (pausedRef.current) return;
      const items = toArray(payload);
      for (const it of items) {
        const user = findUserFromPayload(it) || it;
        if (!user) continue;
        handleVideoState(user);
      }
    };

    const onUserRemoved = (payload) => {
      const items = toArray(payload);
      for (const it of items) {
        const u = findUserFromPayload(it) || it;
        if (u?.userId) {
          clearAllTimers(u.userId);
          heldSetRef.current.delete(u.userId);
        }
      }
    };

    client.on('onUserJoinWaitingRoom', onJoinWaiting);
    client.on('user-added', onUserAdded);
    client.on('user-updated', onUserUpdated);
    client.on?.('onUserVideoStatusChange', onUserUpdated);
    client.on?.('user-removed', onUserRemoved);
    client.on?.('user-left', onUserRemoved);
    client.on?.('user-left-meeting', onUserRemoved);

    // Polling del roster
    if (!pollRef.current) {
      pollRef.current = setInterval(() => {
        if (pausedRef.current) return;
        const roster = getRoster();
        for (const u of roster) handleVideoState(u);
      }, POLL_MS);
    }

    return () => {
      try {
        client.off?.('onUserJoinWaitingRoom', onJoinWaiting);
        client.off?.('user-added', onUserAdded);
        client.off?.('user-updated', onUserUpdated);
        client.off?.('onUserVideoStatusChange', onUserUpdated);
        client.off?.('user-removed', onUserRemoved);
        client.off?.('user-left', onUserRemoved);
        client.off?.('user-left-meeting', onUserRemoved);
      } catch {}

      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }

      stabilizeTimersRef.current.forEach((t) => clearTimeout(t));
      graceTimersRef.current.forEach((t) => clearTimeout(t));
      stabilizeTimersRef.current.clear();
      graceTimersRef.current.clear();
      heldSetRef.current.clear();
    };
  }, [clientRef]);

  // Pausar/Reanudar regla (RECREO)
  useEffect(() => {
    pausedRef.current = pauseCameraRule;

    if (pauseCameraRule) {
      stabilizeTimersRef.current.forEach((t) => clearTimeout(t));
      graceTimersRef.current.forEach((t) => clearTimeout(t));
      stabilizeTimersRef.current.clear();
      graceTimersRef.current.clear();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      console.log("⏸️ Regla de cámara pausada (RECREO)");
    } else {
      // relanzar poll
      if (!pollRef.current && clientRef?.current) {
        pollRef.current = setInterval(() => {
          if (pausedRef.current) return;
          const roster = getRoster();
          for (const u of roster) handleVideoState(u);
        }, POLL_MS);
      }
      console.log("▶️ Regla de cámara reanudada");
    }
  }, [pauseCameraRule, clientRef]);

  // Acciones del host
  const createAndJoinMeeting = async () => {
    const client = clientRef?.current;
    if (!client) return;

    try {
      const resp = await zoomAPI.createMeeting();
      const meetingNumber = String(resp.meetingNumber ?? resp.id); 
      const password = resp.password || '';
      const { signature } = await zoomAPI.getSignature(meetingNumber, 1);

      try { await client.leaveMeeting(true); } catch {}

      await client.join({
        signature,
        meetingNumber,
        password,
        userName: 'Host PoC',
      });

      console.log('✅ Host unido');
    } catch (err) {
      console.error('❌ Error create/join:', err);
    }
  };

  const admitOnHold = async () => {
    const client = clientRef?.current;
    if (!client) return;
    if (!waitingUsers.length) return console.log('❌ Sin usuarios en espera');

    const userToAdmit = waitingUsers[0];
    const guidOrId = userToAdmit.userGuid || userToAdmit.userGUID || userToAdmit.userId;
    if (!guidOrId) return console.log('❌ Falta userGuid/userId para admitir');

    try {
      await client.admit(guidOrId);
      console.log('✅ Admitido desde Waiting Room');
      setWaitingUsers((prev) => prev.slice(1));

      if (userToAdmit.userId) {
        clearAllTimers(userToAdmit.userId);
        heldSetRef.current.delete(userToAdmit.userId);
      } else {
        setTimeout(() => {
          const u = getRoster().find(
            (x) =>
              x.userGUID === userToAdmit.userGUID ||
              x.userGuid === userToAdmit.userGuid
          );
          if (u?.userId) {
            clearAllTimers(u.userId);
            heldSetRef.current.delete(u.userId);
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

    await holdOnce(target);
    clearAllTimers(target.userId);
  };

  return {
    waitingUsers,
    createAndJoinMeeting,
    admitOnHold,
    sendToOnHold,
    handleVideoState,
  };
};
