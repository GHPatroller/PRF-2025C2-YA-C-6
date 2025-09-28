// src/hooks/useZoomEvents.js (cambiar el nombre del archivo)
import { useEffect, useRef } from 'react';
import { toArray, findUserFromPayload } from '../utils/userUtils';

const POLL_MS = 1000;

export const useZoomEvents = (clientRef, callbacks) => {
  const pollRef = useRef(null);

  const getRoster = () => clientRef?.current?.getAttendeeslist?.() || [];

  useEffect(() => {
    const client = clientRef?.current;
    if (!client) return;

    const {
      onUserJoinWaiting,
      onUserAdded,
      onUserUpdated,
      onUserRemoved
    } = callbacks;

    const onJoinWaiting = (payload) => {
      onUserJoinWaiting?.(toArray(payload));
    };

    const handleUserAdded = (payload) => {
      const items = toArray(payload);
      onUserAdded?.(items, getRoster());
    };

    const handleUserUpdated = (payload) => {
      const items = toArray(payload);
      onUserUpdated?.(items, getRoster());
    };

    const handleUserRemoved = (payload) => {
      const items = toArray(payload);
      onUserRemoved?.(items);
    };

    // Suscribir eventos
    client.on('onUserJoinWaitingRoom', onJoinWaiting);
    client.on('user-added', handleUserAdded);
    client.on('user-updated', handleUserUpdated);
    client.on?.('onUserVideoStatusChange', handleUserUpdated);
    client.on?.('user-removed', handleUserRemoved);
    client.on?.('user-left', handleUserRemoved);
    client.on?.('user-left-meeting', handleUserRemoved);

    // Iniciar polling
    if (!pollRef.current) {
      pollRef.current = setInterval(() => {
        callbacks.onPoll?.(getRoster());
      }, POLL_MS);
    }

    // Cleanup
    return () => {
      try {
        client.off?.('onUserJoinWaitingRoom', onJoinWaiting);
        client.off?.('user-added', handleUserAdded);
        client.off?.('user-updated', handleUserUpdated);
        client.off?.('onUserVideoStatusChange', handleUserUpdated);
        client.off?.('user-removed', handleUserRemoved);
        client.off?.('user-left', handleUserRemoved);
        client.off?.('user-left-meeting', handleUserRemoved);
      } catch {}

      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [clientRef, callbacks]);

  return { getRoster };
};