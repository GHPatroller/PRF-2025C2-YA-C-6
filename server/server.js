import express from "express";
import jwt from "jsonwebtoken";
import cors from "cors";
import axios from "axios";

const app = express();
// Aislamiento requerido por Zoom Meeting SDK (SharedArrayBuffer)
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  // util cuando servís assets/estáticos: permite que otros orígenes los embeban
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});

import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static(path.join(__dirname, "../frontend/dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});



//const SDK_KEY = "O8xU5oXLT0yz4HQwyQ0lQ";
//const SDK_SECRET = "Sjd0HoprCL6cEsF3ESthKbjoWTg4aAfh";

// App OAuth / Server-to-Server
//const CLIENT_ID = "IKDeivxRVSgWS6xr1luXA";
//const CLIENT_SECRET = "n6kkHtexIEwTjWhONBV1hsUcmR5Xb3QM";
//const ACCOUNT_ID = "46hGg-fIT8SCYuukeAjZIg"; 

//App Meeting SDK
const SDK_KEY = "ivAxPv8jS2maS22Cbj6gpA";
const SDK_SECRET = "Z8Sw5sOVl5QbN8Ol7PxGm1b0EonQScjj";

//App OAuth / Server-to-Server
const CLIENT_ID = "_v8HO5aMRpqjUTlf3bvMFw";
const CLIENT_SECRET = "64q5oNh1Fj9NEC3NtZ7aVYPqtGkVnnnq";
const ACCOUNT_ID = "rd0OvqylTK-FS-RoaTKWpw"; 



// Crear reunión (OAuth)
app.post("/create-meeting", async (req, res) => {
  try {
    const tokenResponse = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ACCOUNT_ID}`,
      null,
      { auth: { username: CLIENT_ID, password: CLIENT_SECRET } }
    );

    const accessToken = tokenResponse.data.access_token;

    const meetingResponse = await axios.post(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        topic: "PoC Zoom Web SDK",
        type: 1, // instant meeting
        settings: {
          host_video: true,
          participant_video: true,
          waiting_room: true,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const z = meetingResponse.data;

    
    res.json({
      id: z.id,                       
      uuid: z.uuid,
      topic: z.topic,
      join_url: z.join_url,
      start_url: z.start_url,
      password: z.password || "",
      meetingNumber: String(z.id),   
    });
  } catch (err) {
    console.error("❌ Error creando reunión:", err.response?.data || err.message);
    res.status(500).json({ error: "Error creando reunión" });
  }
});


// Generar signature (SDK) — con appKey y clientId
app.post("/get-signature", (req, res) => {
  const { meetingNumber, role } = req.body;
  if (!meetingNumber || role === undefined) {
    return res.status(400).json({ error: "meetingNumber y role son requeridos" });
  }

  try {
    const iat = Math.floor(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2;

    const payload = {
      appKey: SDK_KEY,                 
      clientId: CLIENT_ID || undefined,
      mn: String(meetingNumber),
      role: Number(role) || 1,
      iat,
      exp,
      tokenExp: exp,
    };

    const signature = jwt.sign(payload, SDK_SECRET, { algorithm: "HS256" });
    res.json({ meetingNumber: String(meetingNumber), signature });
  } catch (err) {
    console.error("❌ Error generando signature:", err);
    res.status(500).json({ error: "Error generando signature" });
  }
});

// ------------------------------
app.listen(3000, () =>
  console.log("Backend corriendo en http://localhost:3000")
  


);
