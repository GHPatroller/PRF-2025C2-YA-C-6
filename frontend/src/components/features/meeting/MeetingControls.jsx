import React from 'react';
import { Button } from '../../ui/button/Button';

export const MeetingControls = ({ 
  onCreateJoin, 
  onSendToWaiting, 
  onAdmitFromWaiting, 
  waitingUsersCount 
}) => {
  return (
    <div>
      <Button variant="large" onClick={onCreateJoin}>
        Crear y Unirme como Host
      </Button>

      <div style={{ marginTop: 16 }}>
        <Button variant="warning" onClick={onSendToWaiting}>
          Mandar a sala de espera
        </Button>

        <Button variant="success" onClick={onAdmitFromWaiting} disabled={waitingUsersCount === 0}>
          Sacar de sala de espera ({waitingUsersCount})
        </Button>
      </div>
    </div>
  );
};