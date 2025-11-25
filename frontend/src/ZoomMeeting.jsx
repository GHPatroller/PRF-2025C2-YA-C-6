import React, { useRef, useState, useEffect } from "react";
import { useZoomClient } from "./hooks/useZoomClient";
import { useUserManagement } from "./hooks/useUserManagement";
import { useHideCameraButton } from "./hooks/useHideCameraButton";
import { MeetingControls } from "./components/features/meeting/MeetingControls";
import { YellowCardOverlayLayer } from "./components/features/meeting/YellowCardOverlayLayer";
import { useToggleZoomControls } from "./hooks/useToogleZoomControls";

export default function ZoomMeeting({ role = 0 }) {
  const zoomRef = useRef(null);
  const clientRef = useZoomClient(zoomRef);

  const [isRecreo, setIsRecreo] = useState(false);
  const [isMicPaused, setIsMicPaused] = useState(false);

  // 🔹 Estado y acción para mostrar/ocultar controles de Zoom
  const {
    hidden: areZoomControlsHidden,
    toggle: onToggleZoomControls,
  } = useToggleZoomControls();

  // 🔸 Por ahora NO ocultamos la cámara automáticamente,
  // para no romper la sala de espera ni pelear con el toggle.
  // Si después querés reactivarlo, acá podríamos pasarle clientRef.
  // useHideCameraButton(clientRef);

  const {
    waitingUsers,
    joinMeeting,
    admitOnHold,
    sendToOnHold,
    scoreboard,
    cardSystem,
  } = useUserManagement(clientRef, {
    pauseCameraRule: isRecreo,
    pauseMicRule: isMicPaused,
  });

  useEffect(() => {
    window.__CARD = cardSystem || null;
    window.__ROSTER = () =>
      clientRef.current?.getParticipantsList?.() ||
      clientRef.current?.getAllUser?.() ||
      clientRef.current?.getAttendeeslist?.() ||
      [];
  }, [cardSystem, clientRef]);

  return (
    <div style={{ padding: 16 }}>
      <MeetingControls
        onCreateJoin={joinMeeting}
        onSendToWaiting={() => sendToOnHold()}
        onAdmitFromWaiting={() => admitOnHold()}
        waitingUsersCount={waitingUsers?.length || 0}
        isRecreo={isRecreo}
        isMicPaused={isMicPaused}
        onToggleRecreo={() => setIsRecreo((v) => !v)}
        onToggleMicPaused={() => setIsMicPaused((v) => !v)}
        // 🔹 props nuevas para el botón de mostrar/ocultar controles de Zoom
        areZoomControlsHidden={areZoomControlsHidden}
        onToggleZoomControls={onToggleZoomControls}
      />

      <div
        style={{
          position: "relative",
          width: 1000,
          height: "80vh",
          margin: "20px auto 0",
          background: "#000",
        }}
      >
        <div ref={zoomRef} style={{ position: "absolute", inset: 0 }} />

        <YellowCardOverlayLayer
          zoomRootRef={zoomRef}
          clientRef={clientRef}
          cardSystem={cardSystem}
        />
      </div>
    </div>
  );
}
