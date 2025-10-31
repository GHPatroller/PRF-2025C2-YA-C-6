import React, { useRef, useState } from "react";
import { useZoomClient } from "./hooks/useZoomClient";
import { useUserManagement } from "./hooks/useUserManagement";
import { MeetingControls } from "./components/features/meeting/MeetingControls";
import { YellowCardOverlayLayer } from "./components/features/meeting/YellowCardOverlayLayer";

export default function ZoomMeeting() {
  const zoomRef = useRef(null);
  const clientRef = useZoomClient(zoomRef);

  const [isRecreo, setIsRecreo] = useState(false);
  const [isMicPaused, setIsMicPaused] = useState(false);

  const {
    waitingUsers,
    createAndJoinMeeting,
    admitOnHold,
    sendToOnHold,
    scoreboard,
    cardSystem,
  } = useUserManagement(clientRef, {
    pauseCameraRule: isRecreo,
    pauseMicRule: isMicPaused,
  });

  /** Devuelve Set de userIds con >=1 amarilla */
  const getYellowedUserIds = () => {
    try {
      const result = new Set();
      const yMap = cardSystem?.yellowByKey || new Map();
      const k2id = cardSystem?.keyToLastUserIdRef || new Map();

      for (const [key, count] of yMap.entries()) {
        if (count > 0) {
          const uid = k2id.get(key);
          if (uid != null) result.add(String(uid));
        }
      }
      return result;
    } catch {
      return new Set();
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <MeetingControls
        onCreateJoin={createAndJoinMeeting}
        onSendToWaiting={() => sendToOnHold()}
        onAdmitFromWaiting={() => admitOnHold()}
        waitingUsersCount={waitingUsers?.length || 0}
        isRecreo={isRecreo}
        isMicPaused={isMicPaused}
        onToggleRecreo={() => setIsRecreo((v) => !v)}
        onToggleMicPaused={() => setIsMicPaused((v) => !v)}
      />

      {/* Contenedor relativo para overlay */}
      <div
        style={{
          position: "relative",
          width: 800,
          height: 450,
          margin: "20px auto 0",
          background: "#000",
        }}
      >
        <div
          ref={zoomRef}
          style={{ position: "absolute", inset: 0 }}
        />
        <YellowCardOverlayLayer
          zoomRootRef={zoomRef}
          clientRef={clientRef}
          getYellowedUserIds={getYellowedUserIds}
        />
      </div>
    </div>
  );
}
