// frontend/src/ZoomMeeting.jsx
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
    scoreboard, 
  } = useUserManagement(clientRef, { pauseCameraRule: isRecreo });

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h1>Zoom Embedded PoC</h1>

      <MeetingControls
        onCreateJoin={createAndJoinMeeting}
        onSendToWaiting={sendToOnHold}
        onAdmitFromWaiting={admitOnHold}
        waitingUsersCount={waitingUsers.length}
        isRecreo={isRecreo}
        onToggleRecreo={() => setIsRecreo((v) => !v)}
      />

      {/* SCOREBOARD */}
      <div style={{ maxWidth: 800, margin: "16px auto 0", textAlign: "left" }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Tarjetas (amarillas/rojas)</div>
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 8 }}>
          {(!scoreboard || scoreboard.length === 0) ? (
            <div style={{ opacity: 0.7 }}>Sin participantes listados aún.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 4px" }}>Participante</th>
                  <th style={{ textAlign: "left", padding: "6px 4px" }}>Cámara</th>
                  <th style={{ textAlign: "left", padding: "6px 4px" }}>Amarillas</th>
                  <th style={{ textAlign: "left", padding: "6px 4px" }}>Roja</th>
                </tr>
              </thead>
              <tbody>
                {scoreboard.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "6px 4px" }}>{row.name}</td>
                    <td style={{ padding: "6px 4px" }}>{row.cam}</td>
                    <td style={{ padding: "6px 4px" }}>{row.yellows}</td>
                    <td style={{ padding: "6px 4px", color: row.red ? "#d63031" : "#555" }}>
                      {row.red ? "ROJA" : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div
        ref={zoomRef}
        style={{ width: 800, height: 450, backgroundColor: "#000", margin: "20px auto 0" }}
      />
    </div>
  );
}
