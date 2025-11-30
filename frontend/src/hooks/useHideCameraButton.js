// frontend/src/hooks/useHideCameraButton.js
import { useEffect } from "react";

const BODY_CLASS = "zfe-hide-zoom-buttons";
const TOOLBAR_ANCHOR_SELECTOR = "button.css-1lnylgv"; // botón principal (para detectar toolbar)

// Todos los targets que queremos matar cuando se ocultan los controles
const BTN_SELECTORS = [
  "button.css-1lnylgv",                   // botón principal (video/mic)
  "button.css-1wml07l",                   // botón de la flechita
  "button.css-1wml07l *",                 // hijos del botón (svg, etc.)
  "svg.zoom-MuiSvgIcon-root.css-vubbuv",  // icono flecha
  ".css-vubbuv",                          // por si cambia un poco la estructura

  // Menús emergentes relacionados (por texto / aria)
  "div[role='menu'][aria-label*='cámara']",
  "div[role='menu'][aria-label*='micrófono']",
  "div[role='menu'][aria-label*='camera']",
  "div[role='menu'][aria-label*='microphone']",

  // Fallbacks por aria-label en botones
  ".zm-web-controls button[aria-label*='Video']",
  ".zm-web-controls button[aria-label*='video']",
  ".zm-web-controls button[aria-label*='Audio']",
  ".zm-web-controls button[aria-label*='audio']",
  ".zm-web-controls button[aria-label*='cámara']",
  ".zm-web-controls button[aria-label*='micrófono']",
];

function hideButtonsInline() {
  BTN_SELECTORS.forEach((selector) => {
    const nodes = document.querySelectorAll(selector);
    if (nodes.length) {
      console.log("[ZFE] hideButtonsInline selector:", selector, "->", nodes.length);
    }
    nodes.forEach((el) => {
      el.style.display = "none";
    });
  });
}

function showButtonsInline() {
  BTN_SELECTORS.forEach((selector) => {
    const nodes = document.querySelectorAll(selector);
    if (nodes.length) {
      console.log("[ZFE] showButtonsInline selector:", selector, "->", nodes.length);
    }
    nodes.forEach((el) => {
      el.style.display = "";
    });
  });
}

/**
 * Hook con timer POR USUARIO:
 *  - Arranca cuando la toolbar aparece.
 *  - Se resetea cada vez que la toolbar se destruye y vuelve (ej: sala de espera).
 *  - Mientras el body tenga la clase, seguimos barriendo la UI para matar
 *    cualquier flecha / menú que Zoom vuelva a crear.
 */
export function useHideCameraButton({
  enabled = true,
  delayMs = 60_000, // 1 minuto
} = {}) {
  useEffect(() => {
    console.log("[ZFE] useHideCameraButton effect", { enabled, delayMs });

    if (!enabled) {
      console.log("[ZFE] DISABLED → muestro botones");
      document.body.classList.remove(BODY_CLASS);
      showButtonsInline();
      return;
    }

    let lastHadToolbar = false;
    let timerId = null;
    let pollId = null;
    let cancelled = false;

    const clearTimer = () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    };

    const resetGrace = () => {
      console.log("[ZFE] resetGrace → nueva ventana de tiempo");
      document.body.classList.remove(BODY_CLASS);
      showButtonsInline();
      clearTimer();

      timerId = setTimeout(() => {
        console.log("[ZFE] TIMER FIRED → ocultar botones");
        document.body.classList.add(BODY_CLASS);
        hideButtonsInline();
        console.log(
          "[ZFE] body.classList (after add):",
          document.body.classList.toString()
        );
      }, delayMs);
    };

    // Polling del DOM
    pollId = setInterval(() => {
      if (cancelled) return;

      const toolbarAnchor = document.querySelector(TOOLBAR_ANCHOR_SELECTOR);
      const hasToolbar = !!toolbarAnchor;

      // Cuando aparece la toolbar (ej: entrar o re-entrar a la reunión) → reset
      if (hasToolbar && !lastHadToolbar) {
        console.log("[ZFE] toolbar APARECIÓ → resetGrace()");
        resetGrace();
      }

      lastHadToolbar = hasToolbar;

      // Mientras el body tenga la clase activa, sigo barriendo por si Zoom
      // recrea botones / flechas / menús después del timer.
      if (document.body.classList.contains(BODY_CLASS)) {
        hideButtonsInline();
      }
    }, 800); // cada 800ms

    return () => {
      console.log("[ZFE] useHideCameraButton cleanup");
      cancelled = true;
      if (pollId) clearInterval(pollId);
      clearTimer();
      document.body.classList.remove(BODY_CLASS);
      showButtonsInline();
    };
  }, [enabled, delayMs]);
}
