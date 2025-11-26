// hooks/useToggleZoomControls.js
import { useState, useEffect, useCallback } from "react";

const BODY_CLASS = "zfe-hide-zoom-buttons";

/**
 * Hook para mostrar/ocultar los botones de Zoom
 * desde un botón propio del profesor.
 */
export function useToggleZoomControls() {
  const [hidden, setHidden] = useState(false);

  const applyVisibility = useCallback((hide) => {
    console.log("[ZFE] useToggleZoomControls.applyVisibility", { hide });

    if (hide) {
      document.body.classList.add(BODY_CLASS);
    } else {
      document.body.classList.remove(BODY_CLASS);
    }

    console.log(
      "[ZFE] body.classList ->",
      document.body.classList.toString()
    );
  }, []);

  useEffect(() => {
    console.log("[ZFE] useToggleZoomControls effect, hidden =", hidden);
    applyVisibility(hidden);

    return () => {
      console.log("[ZFE] useToggleZoomControls cleanup");
      applyVisibility(false);
    };
  }, [hidden, applyVisibility]);

  const toggle = useCallback(() => {
    setHidden((prev) => !prev);
  }, []);

  const show = useCallback(() => setHidden(false), []);
  const hide = useCallback(() => setHidden(true), []);

  return { hidden, toggle, show, hide };
}

/**
 * ⏱️ Hook con timer: deja ver los botones
 * durante un tiempo de gracia y después los esconde.
 */
export function useHideCameraButton({
  enabled = true,
  delayMs = 60_000, // 1 minuto
} = {}) {
  useEffect(() => {
    console.log("[ZFE] useHideCameraButton effect", { enabled, delayMs });

    if (!enabled) {
      console.log("[ZFE] useHideCameraButton DISABLED → muestro botones");
      document.body.classList.remove(BODY_CLASS);
      return;
    }

    // al entrar: aseguro que se vean
    document.body.classList.remove(BODY_CLASS);
    console.log(
      "[ZFE] useHideCameraButton START grace → body.classList:",
      document.body.classList.toString()
    );

    const timerId = setTimeout(() => {
      const btns = document.querySelectorAll("button.css-1lnylgv");
      console.log(
        "[ZFE] useHideCameraButton TIMER FIRED → ocultar botones",
        { foundButtons: btns.length }
      );

      document.body.classList.add(BODY_CLASS);
      console.log(
        "[ZFE] body.classList (after add):",
        document.body.classList.toString()
      );
    }, delayMs);

    return () => {
      console.log("[ZFE] useHideCameraButton cleanup → mostrar botones");
      clearTimeout(timerId);
      document.body.classList.remove(BODY_CLASS);
    };
  }, [enabled, delayMs]);
}
