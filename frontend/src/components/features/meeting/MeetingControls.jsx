import React from "react";
import { Button } from "../../ui/button/Button";

export const MeetingControls = ({
  onCreateJoin,
  waitingUsersCount,
  isRecreo = false,
  isMicPaused = false,
  onToggleRecreo = () => {},
  onToggleMicPaused = () => {},
  isTeacher = false,
  onOpenScoreboard = () => {},
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 24,
      }}
    >
      {/* Este lo ven TODOS */}
      <Button variant="large" onClick={onCreateJoin}>
        Unirse a la Reunión
      </Button>

      {/* El resto: SOLO host/profe */}
      {isTeacher && (
        <>
          <div style={{ marginTop: 16 }}>
            <button
              onClick={onOpenScoreboard}
              style={{
                padding: "8px 16px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              📊 Abrir Scoreboard
            </button>
          </div>

          {/* Botón RECREO */}
          <div style={{ marginTop: 16 }}>
            <Button
              variant={isRecreo ? "warning" : "secondary"}
              onClick={onToggleRecreo}
              title={
                isRecreo
                  ? "Reanudar regla de cámara"
                  : "Pausar regla de cámara"
              }
            >
              {isRecreo ? "Finalizar RECREO" : "RECREO"}
            </Button>
          </div>

          {isRecreo && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                border: "1px dashed #e1b12c",
                borderRadius: 8,
                textAlign: "center",
                maxWidth: 300,
              }}
            >
              <strong>Recreo:</strong> la regla de cámara está pausada.
            </div>
          )}

          {/* Botón MIC */}
          <div style={{ marginTop: 16 }}>
            <Button
              variant={isMicPaused ? "warning" : "secondary"}
              onClick={onToggleMicPaused}
              title={
                isMicPaused
                  ? "Reanudar regla de micrófono"
                  : "Pausar regla de micrófono"
              }
            >
              {isMicPaused
                ? "Finalizar pausa de MIC"
                : "Pausar regla de MIC"}
            </Button>
          </div>

          {isMicPaused && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                border: "1px dashed #e1b12c",
                borderRadius: 8,
                textAlign: "center",
                maxWidth: 300,
              }}
            >
              <strong>Micrófono:</strong> la regla de micrófono está pausada.
            </div>
          )}
        </>
      )}
    </div>
  );
};
