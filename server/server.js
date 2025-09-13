import express from "express";
import jwt from "jsonwebtoken";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

// ⚠️ App Meeting SDK
const SDK_KEY = "ivAxPv8jS2maS22Cbj6gpA";
const SDK_SECRET = "Z8Sw5sOVl5QbN8Ol7PxGm1b0EonQScjj";

// ⚠️ App OAuth / Server-to-Server
const CLIENT_ID = "_v8HO5aMRpqjUTlf3bvMFw";
const CLIENT_SECRET = "64q5oNh1Fj9NEC3NtZ7aVYPqtGkVnnnq";
const ACCOUNT_ID = "rd0OvqylTK-FS-RoaTKWpw"; // tu account_id de Zoom

// ------------------------------
// 1️⃣ Crear reunión (OAuth)
app.post("/create-meeting", async (req, res) => {
  try {
    // Obtener access token
    const tokenResponse = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ACCOUNT_ID}`,
      null,
      { auth: { username: CLIENT_ID, password: CLIENT_SECRET } }
    );

    const accessToken = tokenResponse.data.access_token;

    // Crear reunión instantánea
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

    const meetingNumber = meetingResponse.data.id;
    const password = meetingResponse.data.password || "";

    res.json({ meetingNumber, password });
  } catch (err) {
    console.error(
      "❌ Error creando reunión:",
      err.response?.data || err.message
    );
    res.status(500).json({ error: "Error creando reunión" });
  }
});

// ------------------------------
// 2️⃣ Generar signature (SDK)
app.post("/get-signature", (req, res) => {
  const { meetingNumber, role } = req.body;

  if (!meetingNumber || role === undefined) {
    return res
      .status(400)
      .json({ error: "meetingNumber y role son requeridos" });
  }

  try {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60 * 2;

    const payload = {
      appKey: SDK_KEY,
      mn: meetingNumber,
      role,
      iat,
      exp,
      tokenExp: exp,
    };
    const signature = jwt.sign(payload, SDK_SECRET, { algorithm: "HS256" });

    res.json({ meetingNumber, signature });
  } catch (err) {
    console.error("❌ Error generando signature:", err);
    res.status(500).json({ error: "Error generando signature" });
  }
});

// ------------------------------
app.listen(3000, () =>
  console.log("🚀 Backend corriendo en http://localhost:3000")
);
