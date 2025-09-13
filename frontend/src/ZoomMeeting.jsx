import React, { useEffect, useRef, useState } from "react";
import ZoomMtgEmbedded from "@zoom/meetingsdk/embedded";

export default function ZoomMeeting() {
  const zoomRef = useRef(null);
  const clientRef = useRef(null);
  const [meetingInput, setMeetingInput] = useState("");
  const [waitingUsers, setWaitingUsers] = useState([]);
  useEffect(() => {
    if (!zoomRef.current) return;

    const client = ZoomMtgEmbedded.createClient();
    clientRef.current = client;

    client.init({
      debug: true,
      zoomAppRoot: zoomRef.current,
      language: "es-ES",
      customize: {
        video: { isResizable: true, viewSizes: { default: { width: 800, height: 450 } } },
      },
      success: () => console.log("✅ SDK inicializado correctamente"),
      error: (err) => console.error("❌ Error init:", err),
    });
  }, []);

useEffect(() => {
  if (!clientRef.current) return;

  clientRef.current.on("onUserJoinWaitingRoom", (payload) => {
    setWaitingUsers(prev => [...prev, payload]);
  });
}, []);

useEffect(() => {
  if (!clientRef.current) return;

  clientRef.current.on("user-added", async (payload) => {
    console.log("👤 Usuario entró:", payload);

    const attendees = clientRef.current.getAttendeeslist();
    const user = attendees.find(x => x.userGUID === payload.userGUID);
    console.log(user)
    if (user && !user.bVideoOn) {
      try {
        await clientRef.current.putOnHold(user.userId, true);
        console.log(`🚪 Usuario ${user.displayName} enviado a sala de espera`);
      } catch (err) {
        console.error("❌ Error enviando a sala de espera:", err);
      }
    }
  });
}, []);

  const createAndJoinMeeting = async () => {
    if (!clientRef.current) return;

    try {
      const createRes = await fetch("http://localhost:3000/create-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const { meetingNumber, password} = await createRes.json();
        await clientRef.current.leaveMeeting(true);
      console.log("🎯 Reunión creada:", meetingNumber, password);

      const signatureRes = await fetch("http://localhost:3000/get-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingNumber, role: 1 }), // host
      });
      const { signature } = await signatureRes.json();
      console.log("🔑 Signature generada:", signature);

      await clientRef.current.join({
        signature,
        meetingNumber: meetingNumber.toString(),
        password: password || "",
        userName: "Host PoC",
      });
      console.log("✅ Entraste a la reunión");
    } catch (err) {
      console.error("❌ Error join:", err);
    }
  };

  const joinExistingMeeting = async () => {
    if (!clientRef.current || !meetingInput) return;
    try {
      const signatureRes = await fetch("http://localhost:3000/get-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingNumber: meetingInput, role: 0 }), // participante
      });
      const { signature } = await signatureRes.json();

      await clientRef.current.join({
        signature,
        meetingNumber: meetingInput.toString(),
        password: "N6e6av",
        userName: "Guest PoC",
      });
      console.log("✅ Entraste a la reunión existente");
      console.log(clientRef.current.getAttendeeslist());
    } catch (err) {
      console.error("❌ Error join existing:", err);
    }
  };

  const sendToOnHold = async () => {
    if (!clientRef.current) return;

    const attendees = clientRef.current.getAttendeeslist();
    console.log(attendees)
    if (!attendees || attendees.length === 0) {
      console.log("❌ No hay participantes para enviar a sala de espera");
      return;
    }

    const firstUserId = attendees[1].userId;
    console.log(attendees[1])
    try {
      console.log(clientRef.current.media)
      await clientRef.current.putOnHold(firstUserId,true);
      console.log("🔔 Se solicito enviar a sala de espera " + attendees[1]);
    } catch (err) {
      console.error("❌Se solicito enviar a sala de espera a ", err);
    }
  };

   const admitOnHold = async () => {
    if (!clientRef.current) return;

    console.log(waitingUsers)

   let  userToadmit = waitingUsers.find(user => user.userGuid === userGuid)

    if (!waitingUsers || waitingUsers.length === 0) {
      console.log("❌ No hay participantes en sala de espera");
      return;
    }
    try {
    clientRef.current.admit(
      userToadmit.userGuid
     ) // o putOnHold({ userId, hold: false })
  .then(() => console.log("Usuario admitido"))
  .catch(console.error);
    } catch (err) {
      console.error("❌Se solicito admitir", err);
    }
  };


  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h1>Zoom Embedded PoC</h1>

      <button
        onClick={createAndJoinMeeting}
        style={{ padding: "12px 25px", fontSize: "16px", background: "#2d8cff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", margin: "10px" }}
      >
        Crear y Unirme a la Reunión
      </button>

      <div style={{ margin: "20px 0" }}>
        <input
          type="text"
          placeholder="Número de reunión existente"
          value={meetingInput}
          onChange={(e) => setMeetingInput(e.target.value)}
          style={{ padding: "10px", fontSize: "16px", width: "250px", marginRight: "10px" }}
        />
        <button
          onClick={joinExistingMeeting}
          style={{ padding: "10px 20px", fontSize: "16px", background: "#28a745", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
        >
          Unirme a Reunión Existente
        </button>
      </div>

      <button
        onClick={sendToOnHold}
        style={{ padding: "10px 20px", fontSize: "16px", background: "#ff9800", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", marginTop: "10px" }}
      >
        Mandar a sala de espera
      </button>
      <br />
      <button
        onClick={admitOnHold}
        style={{ padding: "10px 20px", fontSize: "16px", background: "#ff9800", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", marginTop: "10px" }}
      >
        Sacar de sala de espera
      </button>
      <div
        ref={zoomRef}
        style={{
          width: "800px",
          height: "450px",
          backgroundColor: "#000",
          margin: "20px auto 0",
        }}
      ></div>
    </div>
  );
}
