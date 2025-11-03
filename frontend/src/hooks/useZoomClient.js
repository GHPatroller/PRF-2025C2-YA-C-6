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
          isResizable: true,
          viewSizes: { default: { width: 1200, height: 720 } },
          // Estas 3 son clave para ver varios mosaicos
          multipleVideoFeeds: true,
          showNonVideoParticipants: true,
          // Nota: algunos docs hablan de viewMode o defaultViewType según versión.
          // Forzamos por API abajo con updateVideoCanvasLayout para que no dependa de esto.
        },
        meetingInfo: [],
      },
      success: () => console.log("✅ SDK inicializado"),
      error: (err) => console.error("❌ Error init:", err),
    });

    // ── Cuando el cliente está conectado, forzamos layout de galería
    const onState = ({ state }) => {
      if (state === "Connected") {
        try {
          const ms = client.getMediaStream?.();
          ms?.updateVideoCanvasLayout?.({
            viewMode: "gallery", // fuerza galería
            layout: "grid",
            maxTiles: 9,         // deja espacio para varios
          });
          console.log("🔳 Forcé layout: gallery/grid");
        } catch (e) {
          console.warn("No pude aplicar layout de galería:", e);
        }
      }
    };

    // Logger útil para ver si el SDK “ve” a los otros con video ON
    const logUsers = async () => {
      try {
        const list = await client.getParticipantsList();
        console.table(
          list.map((p) => ({
            id: p.userId,
            name: p.displayName,
            videoOn: p.bVideoOn,
            audio: p.audio,
          }))
        );
      } catch (e) {}
    };

    client.on("connection-change", onState);
    client.on("user-added", logUsers);
    client.on("user-updated", logUsers);

    return () => {
      client.off?.("connection-change", onState);
      client.off?.("user-added", logUsers);
      client.off?.("user-updated", logUsers);
      clientRef.current = null;
    };
  }, [zoomRef]);

  return clientRef;
};
