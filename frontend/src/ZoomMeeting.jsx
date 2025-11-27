// frontend/src/ZoomMeeting.jsx
import React, { useRef, useState, useEffect } from "react";
import { useZoomClient } from "./hooks/useZoomClient";
import { useUserManagement } from "./hooks/useUserManagement";
import { useHideCameraButton } from "./hooks/useHideCameraButton";
import { MeetingControls } from "./components/features/meeting/MeetingControls";
import { YellowCardOverlayLayer } from "./components/features/meeting/YellowCardOverlayLayer";
import { useToggleZoomControls } from "./hooks/useToggleZoomControls";

const GRACE_MS = 60_000; // 15s para probar

export default function ZoomMeeting({ role = 0 }) {
  const zoomRef = useRef(null);
  const clientRef = useZoomClient(zoomRef);

  const [isRecreo, setIsRecreo] = useState(false);
  const [isMicPaused, setIsMicPaused] = useState(false);

  console.log("[ZFE] ZoomMeeting render", { role });

  const {
    hidden: areZoomControlsHidden,
    toggle: onToggleZoomControls,
  } = useToggleZoomControls();

  // 🔹 Timer: después de GRACE_MS se esconden los botones para todos
  useHideCameraButton({
    enabled: true,
    delayMs: GRACE_MS,
  });

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
