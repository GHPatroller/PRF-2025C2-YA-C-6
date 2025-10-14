import { useEffect, useRef, useCallback } from 'react';
import { toArray } from '../utils/userUtils';

const POLL_MS = 1000;

export const useZoomEvents = (clientRef, callbacks) => {
  const pollRef = useRef(null);
  const subscribedRef = useRef(false);       // evita doble suscripción
  const cbsRef = useRef(callbacks);          //  callbacks actuales


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

  const handleUserUpdated = useCallback((payload) => {
    const items = toArray(payload);
    cbsRef.current.onUserUpdated?.(items, getRoster());
  }, [getRoster]);

  const handleUserRemoved = useCallback((payload) => {
    const items = toArray(payload);
    cbsRef.current.onUserRemoved?.(items);
  }, []);

  useEffect(() => {
    const client = clientRef?.current;
    if (!client) return;

    if (subscribedRef.current) {
      // evita duplicado por StrictMode/HMR
      return;
    }
    subscribedRef.current = true;

    // Suscripcion unica
    client.on('onUserJoinWaitingRoom', onJoinWaiting);
    client.on('user-added', handleUserAdded);
    client.on('user-updated', handleUserUpdated);
    client.on?.('onUserVideoStatusChange', handleUserUpdated);

    
    client.on?.('user-removed', handleUserRemoved);
    // client.on?.('user-left', handleUserRemoved);
    // client.on?.('user-left-meeting', handleUserRemoved);

    // Poll único
    if (!pollRef.current) {
      pollRef.current = setInterval(() => {
        cbsRef.current.onPoll?.(getRoster());
      }, POLL_MS);
    }

    return () => {
      try {
        client.off?.('onUserJoinWaitingRoom', onJoinWaiting);
        client.off?.('user-added', handleUserAdded);
        client.off?.('user-updated', handleUserUpdated);
        client.off?.('onUserVideoStatusChange', handleUserUpdated);
        client.off?.('user-removed', handleUserRemoved);
        // client.off?.('user-left', handleUserRemoved);
        // client.off?.('user-left-meeting', handleUserRemoved);
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
