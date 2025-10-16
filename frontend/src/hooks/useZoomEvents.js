import { useEffect, useRef, useCallback } from 'react';
import { toArray } from '../utils/userUtils';

const POLL_MS = 1000;

export const useZoomEvents = (clientRef, callbacks) => {
  const pollRef = useRef(null);
  const subscribedRef = useRef(false);       // evita doble suscripción
  const cbsRef = useRef(callbacks);          // callbacks actuales

  useEffect(() => {
    cbsRef.current = callbacks;
  }, [callbacks]);

  const getRoster = useCallback(
    () => clientRef?.current?.getAttendeeslist?.() || [],
    [clientRef]
  );

  const onJoinWaiting = useCallback((payload) => {
    cbsRef.current.onUserJoinWaiting?.(toArray(payload));
  }, []);

  const handleUserAdded = useCallback((payload) => {
    const items = toArray(payload);
    cbsRef.current.onUserAdded?.(items, getRoster());
  }, [getRoster]);

  // ⚡ Nueva versión: permite diferenciar tipo
  const handleUserUpdated = useCallback((payload, typeHint = 'generic') => {
    const items = toArray(payload);
    // inyectamos el tipo (audio/video) para que el resto lo use
    items.forEach(item => (item.__eventType = typeHint));
    cbsRef.current.onUserUpdated?.(items, getRoster());
  }, [getRoster]);

  const handleUserRemoved = useCallback((payload) => {
    const items = toArray(payload);
    cbsRef.current.onUserRemoved?.(items);
  }, []);

  useEffect(() => {
    const client = clientRef?.current;
    if (!client) return;
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    // === Suscripciones ===
    client.on('onUserJoinWaitingRoom', onJoinWaiting);
    client.on('user-added', handleUserAdded);
    client.on('user-removed', handleUserRemoved);
    client.on('user-updated', (p) => handleUserUpdated(p, 'generic'));
    client.on?.('onUserVideoStatusChange', (p) => handleUserUpdated(p, 'video'));
    client.on?.('onUserAudioStatusChange', (p) => handleUserUpdated(p, 'audio'));

    // === Poll ===
    if (!pollRef.current) {
      pollRef.current = setInterval(() => {
        cbsRef.current.onPoll?.(getRoster());
      }, POLL_MS);
    }

    // === Cleanup ===
    return () => {
      try {
        client.off?.('onUserJoinWaitingRoom', onJoinWaiting);
        client.off?.('user-added', handleUserAdded);
        client.off?.('user-removed', handleUserRemoved);
        client.off?.('user-updated');
        client.off?.('onUserVideoStatusChange');
        client.off?.('onUserAudioStatusChange');
      } catch {}
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      subscribedRef.current = false;
    };
  }, [clientRef, onJoinWaiting, handleUserAdded, handleUserUpdated, handleUserRemoved, getRoster]);

  return { getRoster };
};
