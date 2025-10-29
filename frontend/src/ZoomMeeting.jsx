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
    cardSystem
  } = useUserManagement(clientRef, { pauseCameraRule: isRecreo , pauseMicRule: isMicPaused });

    // Devuelve el set de userIds con >=1 amarilla (lee refs internos del hook)
  const getYellowedUserIds = () => {
    try {
      const set = new Set();
      const yMap = cardSystem?.yellowByKey || new Map();
      const keyToUid = cardSystem?.keyToLastUserIdRef || new Map();
      yMap.forEach((count, key) => {
        if (count > 0) {
          const uid = keyToUid.get(key);
          if (uid != null) set.add(String(uid));
        }
      });
      return set;
    } catch {
      return new Set();
    }
  };

  return (
   <div style={{ padding: "20px", textAlign: "center" }}>
      <h1>Zoom For Education</h1>

      <MeetingControls
        onCreateJoin={createAndJoinMeeting}
        onSendToWaiting={sendToOnHold}
        onAdmitFromWaiting={admitOnHold}
        waitingUsersCount={waitingUsers.length}
        isRecreo={isRecreo}
        onToggleRecreo={() => setIsRecreo((v) => !v)}
        isMicPaused={isMicPaused}
        onToggleMicPaused={() => setIsMicPaused(v => !v)}
      />

            {/* Contenedor relativo: overlay se posiciona sobre el grid de Zoom */}
      <div style={{ position: "relative", width: 800, height: 450, margin: "20px auto 0" }}>
        <div
          ref={zoomRef}
          style={{ width: "100%", height: "100%", backgroundColor: "#000" }}
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
