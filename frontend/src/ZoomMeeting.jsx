import React, { useEffect, useRef, useState } from "react";
import ZoomMtgEmbedded from "@zoom/meetingsdk/embedded";
import { Button } from "./components/ui/button/Button";
import { useZoomClient } from "./hooks/useZoomClient";
import { useUserManagement } from "./hooks/useUserManagement";

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

      <Button variant="large" onClick={createAndJoinMeeting}>
        Crear y Unirme como Host
      </Button>

      <div style={{ marginTop: 16 }}>
        <Button variant="warning" onClick={sendToOnHold}>
          Mandar a sala de espera
        </Button>

        <Button variant="success" onClick={admitOnHold}>
          Sacar de sala de espera
        </Button>
      </div>

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

