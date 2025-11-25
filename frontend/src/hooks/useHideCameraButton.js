import { useEffect } from "react";

/**
 * Versión neutra: por ahora no oculta nada.
 * La dejamos para que no rompa imports viejos.
 */
export function useHideCameraButton() {
  useEffect(() => {
    // Intencionalmente vacío.
    // Más adelante, si queremos, lo reimplementamos
    // solo para alumnos y solo cuando estén en la reunión.
  }, []);
}
