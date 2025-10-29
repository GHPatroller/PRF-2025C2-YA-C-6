import React, { useEffect, useRef, useState } from "react";

// Throttle muy simple para no recalcular en cada micro-cambio
const throttle = (fn, ms = 80) => {
  let last = 0, tid;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now; fn(...args);
    } else {
      clearTimeout(tid);
      tid = setTimeout(() => { last = Date.now(); fn(...args); }, ms - (now - last));
    }
  };
};

/**
 * Props:
 *  - zoomRootRef: ref al div donde inicializás Zoom (zoomAppRoot)
 *  - clientRef: ref del cliente Zoom (useZoomClient)
 *  - getYellowedUserIds: () => Set<string> con userIds que tienen amarilla (>0)
 *
 * Estrategia:
 *  1) Ubicamos los "tiles" de video dentro de zoomRoot por selectores heurísticos.
 *  2) Leemos sus bounding rects y dibujamos divs absolutos por arriba.
 *  3) Recalculamos en mutaciones, resize, eventos del SDK y cuando cambia el scoreboard.
 */
export function YellowCardOverlayLayer({ zoomRootRef, clientRef, getYellowedUserIds }) {
  const [markers, setMarkers] = useState([]);
  const recompute = throttle(() => {
    const root = zoomRootRef?.current;
    if (!root) return;

    // Heurística de selectores (ajustalo si Zoom cambia clases)
    const selectors = [
      '[data-participant-id]',
      '.zmu-video-item',
      '[class*="participant"][class*="video"]',
    ];

    let tiles = [];
    for (const sel of selectors) {
      const found = Array.from(root.querySelectorAll(sel));
      if (found.length) { tiles = found; break; }
    }

    const yellowSet = (getYellowedUserIds?.() || new Set());
    const rootRect = root.getBoundingClientRect();
    const next = [];

    const getUserIdFromTile = (el) =>
      el.getAttribute?.('data-participant-id') ||
      el.dataset?.participantId ||
      (el.__fakeId ||= `anon-${Math.random().toString(36).slice(2,7)}`);

    tiles.forEach((el) => {
      const uid = String(getUserIdFromTile(el));
      if (!yellowSet.has(uid)) return;

      const r = el.getBoundingClientRect();
      const size = 24, pad = 8;

      next.push({
        key: uid,
        top: Math.max(0, r.top - rootRect.top + pad),
        left: Math.max(0, r.left - rootRect.left + r.width - size - pad),
        size
      });
    });

    setMarkers(next);
  }, 80);

  // Observá cambios de DOM y tamaño dentro del root de Zoom
  useEffect(() => {
    const root = zoomRootRef?.current;
    if (!root) return;

    const mo = new MutationObserver(recompute);
    mo.observe(root, { childList: true, subtree: true, attributes: true });

    const ro = new ResizeObserver(recompute);
    ro.observe(root);

    window.addEventListener('resize', recompute);
    root.addEventListener('scroll', recompute, true);

    // Cuando se actualiza el scoreboard (lo dispara useUserManagement)
    const onBoard = () => recompute();
    window.addEventListener('scoreboard-updated', onBoard);

    recompute();

    return () => {
      mo.disconnect();
      ro.disconnect();
      window.removeEventListener('resize', recompute);
      root.removeEventListener('scroll', recompute, true);
      window.removeEventListener('scoreboard-updated', onBoard);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomRootRef?.current]);

  // Volvé a calcular ante eventos relevantes del SDK
  useEffect(() => {
    const client = clientRef?.current;
    if (!client) return;

    const events = [
      'user-added', 'user-removed', 'user-updated',
      'video-active-change', 'active-speaker'
    ];
    const handler = () => recompute();

    events.forEach(ev => client.on(ev, handler));
    recompute();

    return () => { events.forEach(ev => client.off(ev, handler)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientRef?.current]);

  // Capa flotante por arriba del grid de Zoom
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999
      }}
      aria-hidden
    >
      {markers.map(m => (
        <div
          key={m.key}
          title="Tarjeta amarilla"
          style={{
            position: 'absolute',
            top: m.top,
            left: m.left,
            width: m.size,
            height: m.size,
            background: 'yellow',
            border: '2px solid #000',
            borderRadius: 4,
            boxShadow: '0 0 0 1px rgba(0,0,0,.15)',
            pointerEvents: 'none'
          }}
        />
      ))}
    </div>
  );
}
