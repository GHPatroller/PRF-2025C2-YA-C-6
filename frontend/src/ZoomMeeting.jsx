import React, { useEffect, useRef, useState } from "react";
import ZoomMtgEmbedded from "@zoom/meetingsdk/embedded";
import { Button } from "./components/ui/button/Button";
import { useZoomClient } from "./hooks/useZoomClient";
import { useUserManagement } from "./hooks/useUserManagement";
import { MeetingControls } from "./components/features/meeting/MeetingControls";


const GRACE_MS = 10_000;   // 10 seg gracia
const STABILIZE_MS = 1200; // delay para que bVideoOn se estabilice
const POLL_MS = 1000;      // frecuencia del poll del roster

export default function ZoomMeeting() {
  const zoomRef = useRef(null);
  const clientRef = useZoomClient(zoomRef);
  const { waitingUsers, createAndJoinMeeting, admitOnHold, sendToOnHold } = useUserManagement(clientRef);

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h1>Zoom Embedded PoC</h1>

      <MeetingControls 
        onCreateJoin={createAndJoinMeeting}
        onSendToWaiting={sendToOnHold}
        onAdmitFromWaiting={admitOnHold}
        waitingUsersCount={waitingUsers.length}
      />

      <div
        ref={zoomRef}
        style={{
          width: "800px",
          height: "450px",
          backgroundColor: "#000",
          margin: "20px auto 0",
        }}
      />
    </div>
  );
}

