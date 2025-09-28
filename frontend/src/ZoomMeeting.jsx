import React, { useRef, useState } from "react";
import { useZoomClient } from "./hooks/useZoomClient";
import { useUserManagement } from "./hooks/useUserManagement";
import { MeetingControls } from "./components/features/meeting/MeetingControls";

export default function ZoomMeeting() {
  const zoomRef = useRef(null);
  const clientRef = useZoomClient(zoomRef);

  const [isRecreo, setIsRecreo] = useState(false);

  const {
    waitingUsers,
    createAndJoinMeeting,
    admitOnHold,
    sendToOnHold,
  } = useUserManagement(clientRef, { pauseCameraRule: isRecreo });

  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <h1>Zoom Embedded PoC</h1>

      <MeetingControls
        onCreateJoin={createAndJoinMeeting}
        onSendToWaiting={sendToOnHold}
        onAdmitFromWaiting={admitOnHold}
        waitingUsersCount={waitingUsers.length}
        isRecreo={isRecreo}
        onToggleRecreo={() => setIsRecreo((v) => !v)}
      />

      <div
        ref={zoomRef}
        style={{
          width: 800,
          height: 450,
          backgroundColor: "#000",
          margin: "20px auto 0",
        }}
      />
    </div>
  );
}
