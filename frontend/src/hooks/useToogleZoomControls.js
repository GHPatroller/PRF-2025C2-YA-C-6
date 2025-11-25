// hooks/useToggleZoomControls.js
import { useState, useEffect, useCallback } from "react";

/**
 * Hook para mostrar/ocultar botones de la UI de Zoom
 * (video, mic, etc.) desde un botón propio.
 *
 * Uso:
 *   const { hidden, toggle } = useToggleZoomControls();
 *   <button onClick={toggle}>...</button>
 */
export function useToggleZoomControls() {
  const [hidden, setHidden] = useState(false);

  const applyVisibility = useCallback((hide) => {
    // 👇 Selectores de los botones que querés controlar
    // Por ahora uso el que ya usabas para la cámara
    const selectors = [
      "button.css-1lnylgv", // cámara
      // cuando tengas el del mic, lo agregás acá
      // "button.EL_SELECTOR_DEL_MIC",
    ];

    selectors.forEach((selector) => {
      const buttons = document.querySelectorAll(selector);
      console.log(
        "[ZFEv1] applyVisibility",
        hide ? "OCULTAR" : "MOSTRAR",
        selector,
        "->",
        buttons.length
      );

      buttons.forEach((btn) => {
        btn.style.display = hide ? "none" : "";
      });
    });
  }, []);

  useEffect(() => {
    applyVisibility(hidden);
    // Al desmontar, aseguro que vuelvan a aparecer
    return () => applyVisibility(false);
  }, [hidden, applyVisibility]);

  const toggle = useCallback(() => {
    setHidden((prev) => !prev);
  }, []);

  return { hidden, toggle };
}
