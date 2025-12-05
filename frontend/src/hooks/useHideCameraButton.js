// frontend/src/hooks/useHideCameraButton.js
import { useEffect } from "react";

const BODY_CLASS = "zfe-hide-zoom-buttons";
const TOOLBAR_ANCHOR_SELECTOR = "button.css-1lnylgv";

// Elementos que queremos ocultar cuando se bloquean los controles
const BTN_SELECTORS = [
  "button.css-1lnylgv",                  // botón principal (video/mic)
  "button.css-1wml07l",                  // botón de la flechita
  "button.css-1wml07l *",                // hijos del botón (svg, etc.)
  "svg.zoom-MuiSvgIcon-root.css-vubbuv", // icono flecha
  ".css-vubbuv",

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
    nodes.forEach((el) => {
      el.style.display = "none";
    });
  });
}

function showButtonsInline() {
  BTN_SELECTORS.forEach((selector) => {
    const nodes = document.querySelectorAll(selector);
    nodes.forEach((el) => {
      el.style.display = "";
    });
  });
}

/**
 * Hook con timer POR USUARIO:
 *  - Arranca cuando aparece la toolbar.
 *  - Se resetea si la toolbar se destruye y vuelve (waiting room, reconexión, etc.).
 *  - Mientras el body tenga la clase, sigue barriendo la UI para ocultar
 *    cualquier botón/flecha/menú que Zoom vuelva a renderizar.
 */
export function useHideCameraButton({
  enabled = true,
  delayMs = 60_000, // 1 minuto
} = {}) {
  useEffect(() => {
    if (!enabled) {
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
      document.body.classList.remove(BODY_CLASS);
      showButtonsInline();
      clearTimer();

      timerId = setTimeout(() => {
        document.body.classList.add(BODY_CLASS);
        hideButtonsInline();
      }, delayMs);
    };

    // Polling del DOM
    pollId = setInterval(() => {
      if (cancelled) return;

      const toolbarAnchor = document.querySelector(TOOLBAR_ANCHOR_SELECTOR);
      const hasToolbar = !!toolbarAnchor;

      // Cuando aparece la toolbar (entrar o re-entrar a la reunión) → reset
      if (hasToolbar && !lastHadToolbar) {
        resetGrace();
      }

      lastHadToolbar = hasToolbar;

      // Mientras el body tenga la clase activa, seguimos ocultando
      if (document.body.classList.contains(BODY_CLASS)) {
        hideButtonsInline();
      }
    }, 800);

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      clearTimer();
      document.body.classList.remove(BODY_CLASS);
      showButtonsInline();
    };
  }, [enabled, delayMs]);
}
