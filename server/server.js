import express from "express";
import jwt from "jsonwebtoken";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

// ⚠️ App Meeting SDK
const SDK_KEY = "O8xU5oXLT0yz4HQwyQ0lQ";
const SDK_SECRET = "Sjd0HoprCL6cEsF3ESthKbjoWTg4aAfh";

// ⚠️ App OAuth / Server-to-Server
const CLIENT_ID = "IKDeivxRVSgWS6xr1luXA";
const CLIENT_SECRET = "n6kkHtexIEwTjWhONBV1hsUcmR5Xb3QM";
const ACCOUNT_ID = "46hGg-fIT8SCYuukeAjZIg"; // tu account_id de Zoom

// ------------------------------
// 1️⃣ Crear reunión (OAuth)
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

    // 🔁 Normalizamos lo que va al frontend (no mandes nada sensible)
    res.json({
      id: z.id,                       // número de reunión
      uuid: z.uuid,
      topic: z.topic,
      join_url: z.join_url,
      start_url: z.start_url,
      password: z.password || "",
      meetingNumber: String(z.id),    // por si tu UI lo espera como string
    });
  } catch (err) {
    console.error("❌ Error creando reunión:", err.response?.data || err.message);
    res.status(500).json({ error: "Error creando reunión" });
  }
});

// ------------------------------
// 2️⃣ Generar signature (SDK)
app.post("/get-signature", (req, res) => {
  const { meetingNumber, role } = req.body;
  if (!meetingNumber || role === undefined) {
    return res.status(400).json({ error: "meetingNumber y role son requeridos" });
  }

  try {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60 * 2;

    const payload = {
      sdkKey: SDK_KEY,   // ✅ usar sdkKey
      mn: String(meetingNumber),
      role: Number(role),
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
  console.log("🚀 Backend corriendo en http://localhost:3000")
  


);
