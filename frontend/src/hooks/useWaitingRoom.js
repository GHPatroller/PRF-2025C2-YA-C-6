import { useState } from 'react';
import { userUtils } from './utils/userUtils';

export const useWaitingRoom = (clientRef, videoControl) => {
  const [waitingUsers, setWaitingUsers] = useState([]);

  const admitFromWaitingRoom = async (userToAdmit) => {
    const client = clientRef?.current;
    if (!client || !userToAdmit) return;

    const guidOrId = userToAdmit.userGuid || userToAdmit.userGUID || userToAdmit.userId;
    if (!guidOrId) return console.log('❌ Falta userGuid/userId para admitir');

    try {
      await client.admit(guidOrId);
      console.log('✅ Admitido desde Waiting Room');
      
      // Remover de waitingUsers
      setWaitingUsers(prev => prev.filter(user => 
        user.userGuid !== userToAdmit.userGuid && 
        user.userGUID !== userToAdmit.userGUID &&
        user.userId !== userToAdmit.userId
      ));

      // Limpiar timers si existe
      if (userToAdmit.userId && videoControl) {
        videoControl.clearUserTimers(userToAdmit.userId);
      }
    } catch (err) {
      console.error('❌ Error admit:', err);
    }
  };

  const addToWaitingRoom = (users) => {
    setWaitingUsers(prev => [...prev, ...userUtils.toArray(users)]);
  };

  return {
    waitingUsers,
    setWaitingUsers,
    admitFromWaitingRoom,
    addToWaitingRoom
  };
};