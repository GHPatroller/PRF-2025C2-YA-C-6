import React from 'react';
import { Button } from '../../ui/button/Button';

export const MeetingControls = ({ 
  onCreateJoin, 
  onSendToWaiting, 
  onAdmitFromWaiting, 
  waitingUsersCount,
  isRecreo = false, 
  isMicPaused = false,         
  onToggleRecreo = () => {} , 
  onToggleMicPaused = () => {}  
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

        <Button 
          variant="success" 
          onClick={onAdmitFromWaiting} 
          disabled={waitingUsersCount === 0}
        >
          Sacar de sala de espera ({waitingUsersCount})
        </Button>

        <button
          onClick={() => window.open('/scoreboard', '_blank', 'noopener,noreferrer')}
>
          Abrir Scoreboard
        </button>
      </div>

      {/* Botón RECREO */}
      <div style={{ marginTop: 16 }}>
        <Button
          variant={isRecreo ? "warning" : "secondary"}
          onClick={onToggleRecreo}
          title={isRecreo ? "Reanudar regla de cámara" : "Pausar regla de cámara"}
        >
          {isRecreo ? "Finalizar RECREO" : "RECREO"}
        </Button>
      </div>

      {isRecreo && (
        <div style={{ marginTop: 8, padding: 8, border: "1px dashed #e1b12c", borderRadius: 8 }}>
          <strong>Recreo:</strong> la regla de cámara está pausada.
        </div>
      )}
   

    {/* Boton MIC */}
      <div style={{ marginTop: 16 }}>
        <Button
          variant={isMicPaused ? 'warning' : 'secondary'}
          onClick={onToggleMicPaused}
          title={isMicPaused ? 'Reanudar regla de micrófono' : 'Pausar regla de micrófono'}
        >
          {isMicPaused ? 'Finalizar pausa de MIC' : 'Pausar regla de MIC'}
        </Button>
      </div>

      {isMicPaused && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            border: '1px dashed #e1b12c',
            borderRadius: 8,
          }}
        >
          <strong>Micrófono:</strong> la regla de micrófono está pausada.
        </div>
      )}
    </div>

  );
};
