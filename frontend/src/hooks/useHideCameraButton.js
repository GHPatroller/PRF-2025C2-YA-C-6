import { useEffect, useRef } from "react";

/**
 * Oculta el botón de cámara SOLO cuando el meeting está INMEETING.
 * Hay que pasarle el `client` del Zoom Meeting SDK.
 *
 * Uso:
 *   const client = useZoomClient();
 *   useHideCameraButton(client);
 */
export function useHideCameraButton(client) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!client) return;

    const hideCameraButton = () => {
      const buttons = document.querySelectorAll("button.css-1lnylgv");
      console.log(
        "[ZFEv1] hideCameraButton -> css-1lnylgv encontrados:",
        buttons.length
      );
      buttons.forEach((btn) => {
        btn.style.display = "none";
      });
    };

    const showCameraButton = () => {
      const buttons = document.querySelectorAll("button.css-1lnylgv");
      buttons.forEach((btn) => {
        btn.style.display = "";
      });
    };

    const clearTimer = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const onStatusChange = (payload) => {
      const status = payload.meetingStatus;
      console.log("[ZFEv1] meeting-status-change:", status);

      if (status === "MEETING_STATUS_INMEETING") {
        // Ya estamos dentro de la reunión → oculto y mantengo oculto
        hideCameraButton();
        clearTimer();
        intervalRef.current = setInterval(hideCameraButton, 1500);
      } else {
        // Waiting room / reconectando / etc → NO oculto nada
        clearTimer();
        showCameraButton();
      }
    };

    // Suscribirse al evento del SDK
    client.on("meeting-status-change", onStatusChange);

    // Por si el hook se monta cuando YA estamos en la reunión
    const currentStatus =
      typeof client.getMeetingStatus === "function"
        ? client.getMeetingStatus()
        : null;
    if (currentStatus === "MEETING_STATUS_INMEETING") {
      onStatusChange({ meetingStatus: currentStatus });
    }

    return () => {
      clearTimer();
      client.off("meeting-status-change", onStatusChange);
      // Al salir, restauro botones por las dudas
      showCameraButton();
    };
  }, [client]);
}
