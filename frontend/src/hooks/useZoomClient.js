// frontend/src/hooks/useZoomClient.js
import { useEffect, useRef } from "react";
import ZoomMtgEmbedded from "@zoom/meetingsdk/embedded";

export const useZoomClient = (zoomRef) => {
  const clientRef = useRef(null);

  useEffect(() => {
    if (!zoomRef.current) return;

    const client = ZoomMtgEmbedded.createClient();
    clientRef.current = client;

    client.init({
      debug: true,
      zoomAppRoot: zoomRef.current,
      language: "es-ES",
      customize: {
        video: {
          isResizable: true,                    // ← CLAVE
          viewSizes: { default: { width: 800, height: 450 } },
        },
        meetingInfo: [], // ok
      },
      success: () => console.log("✅ SDK inicializado"),
      error: (err) => console.error("❌ Error init:", err),
    });

    return () => { clientRef.current = null; };
  }, [zoomRef]);

  return clientRef;
};
