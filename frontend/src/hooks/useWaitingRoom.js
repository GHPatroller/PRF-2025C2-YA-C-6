// src/hooks/useWaitingRoom.js
import { useState } from 'react';

export const useWaitingRoom = () => {
  const [waitingUsers, setWaitingUsers] = useState([]);

  const addWaitingUsers = (users) => {
    setWaitingUsers(prev => [...prev, ...users]);
  };

  const removeWaitingUser = (userId) => {
    setWaitingUsers(prev => prev.filter(user => 
      user.userId !== userId && 
      user.userGUID !== userId && 
      user.userGuid !== userId
    ));
  };

  const admitFirstWaitingUser = () => {
    if (waitingUsers.length === 0) return null;
    const userToAdmit = waitingUsers[0];
    setWaitingUsers(prev => prev.slice(1));
    return userToAdmit;
  };

  const clearWaitingRoom = () => {
    setWaitingUsers([]);
  };

  return {
    waitingUsers,
    addWaitingUsers,
    removeWaitingUser,
    admitFirstWaitingUser,
    clearWaitingRoom,
    setWaitingUsers // Para compatibilidad temporal
  };
};