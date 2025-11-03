// src/components/features/meeting/YellowCardOverlayLayer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MOUNT_AT_BODY = true;      // portal a <body> (evita clipping por overflow)
const USE_FIXED_OVERLAY = true;  // overlay fijo al viewport (sigue el scroll)

const throttle = (fn, ms = 120) => {
  let last = 0, tid;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
    else {
      clearTimeout(tid);
      tid = setTimeout(() => { last = Date.now(); fn(...args); }, ms - (now - last));
    }
  };
};

export function YellowCardOverlayLayer({ zoomRootRef, clientRef, cardSystem }) {
  const hostRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [tiles, setTiles] = useState([]); // [{x,y,w,h,size,count}]

  const [idToName, setIdToName] = useState(new Map());

  // ===== Mount del host del overlay =====
  useEffect(() => {
    const root = zoomRootRef?.current;
    if (!root) return;
    const host = document.createElement("div");
    host.id = "yellow-overlay-host";
    host.style.position = USE_FIXED_OVERLAY ? "fixed" : "absolute";
    host.style.inset = "0";
    host.style.pointerEvents = "none";
    host.style.zIndex = "2147483647";
    host.style.overflow = "visible";
    (MOUNT_AT_BODY ? document.body : root).appendChild(host);
    hostRef.current = host;
    setMounted(true);
    return () => {
      try { (MOUNT_AT_BODY ? document.body : root).removeChild(host); } catch {}
      hostRef.current = null;
      setMounted(false);
    };
  }, [zoomRootRef]);

  // ===== Helpers DOM =====
  const climbToTile = (node, maxHops = 8) => {
    let cur = node;
    for (let i = 0; i < maxHops && cur; i++) {
      const rect = cur.getBoundingClientRect?.();
      if (!rect) break;
      const area = rect.width * rect.height;
      const st = getComputedStyle(cur);
      if (st.display !== "none" && st.visibility !== "hidden" && area > 10000) {
        return { node: cur, rect };
      }
      cur = cur.parentElement;
    }
    return null;
  };

  // Dado un nombre, encuentra el TILE que:
  //   a) Contiene un <video>/<canvas> (o su contenedor visual)
  //   b) Su texto visible incluye el displayName
  const findTileRectForName = (root, displayName) => {
    const name = String(displayName || "").trim().toLowerCase();
    if (!name) return null;

    const visuals = Array.from(root.querySelectorAll("video,canvas"));
    for (const v of visuals) {
      const climbed = climbToTile(v, 10);
      if (!climbed) continue;
      const { node, rect } = climbed;

      const visibleText = (node.textContent || "").trim().toLowerCase();
      if (!visibleText) continue;
      if (!visibleText.includes(name)) continue;

      // Encontramos un tile cuyo subtree incluye el nombre
      return rect;
    }
    return null;
  };

  // ===== Roster -> id -> nombre =====
  const refreshParticipants = useMemo(() =>
    throttle(() => {
      const c = clientRef?.current;
      if (!c) return;
      try {
        const list = c.getAllUser?.() || c.getAttendeeslist?.() || [];
        const i2n = new Map();
        list.forEach((u) => {
          const uid  = u?.userId ?? u?.userID ?? u?.id;
          const name = u?.displayName ?? u?.userName ?? u?.name ?? "";
          if (uid != null) i2n.set(String(uid), name);
        });
        setIdToName(i2n);
      } catch {}
    }, 250)
  , [clientRef]);

  // ===== Construcción de tiles: 1 rect por CADA usuario con amarillas =====
  const refreshTiles = useMemo(() =>
    throttle(async () => {
      const root = zoomRootRef?.current;
      const host = hostRef.current;
      if (!root || !host) return;

      let idsMap = new Map(); // Map<userId, count>
      try {
        const m = cardSystem?.getYellowByUserId?.();
        idsMap = m instanceof Promise ? await m : (m || new Map());
      } catch { idsMap = new Map(); }

      if (!(idsMap instanceof Map) || idsMap.size === 0) {
        setTiles([]);
        return;
      }

      const matches = [];
      for (const [id, count] of idsMap.entries()) {
        const name = idToName.get(String(id)) || String(id);
        const rect = findTileRectForName(root, name);
        if (!rect) continue;

        const { left: x, top: y, width: w, height: h } = rect;
        const size  = Math.max(24, Math.min(w, h) * 0.25);
        const badge = Math.max(1, Math.min(99, Number(count) || 1));
        matches.push({ x, y, w, h, size, count: badge });
      }

      setTiles(matches);
    }, 200)
  , [zoomRootRef, cardSystem, idToName]);

  // ===== Suscripciones / observers =====
  useEffect(() => {
    const c = clientRef?.current;
    const root = zoomRootRef?.current;
    if (!c || !root) return;

    const handlers = [
      ["user-added",        refreshParticipants],
      ["user-removed",      refreshParticipants],
      ["user-updated",      () => { refreshParticipants(); refreshTiles(); }],
      ["active-speaker",    refreshTiles],
      ["video-active-change", refreshTiles],
      ["room-change",       () => { refreshParticipants(); refreshTiles(); }],
      ["meeting-status",    () => { refreshParticipants(); refreshTiles(); }],
    ];
    handlers.forEach(([ev, fn]) => { try { c.on?.(ev, fn); } catch {} });

    const ro = new ResizeObserver(() => refreshTiles());
    try { ro.observe(root); } catch {}

    const mo = new MutationObserver(() => refreshTiles());
    try { mo.observe(root, { childList: true, subtree: true, attributes: true }); } catch {}

    const onScroll = throttle(() => refreshTiles(), 120);
    root.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", refreshTiles);

    refreshParticipants();
    refreshTiles();

    return () => {
      try { ro.disconnect(); } catch {}
      try { mo.disconnect(); } catch {}
      try { root.removeEventListener("scroll", onScroll); } catch {}
      try { window.removeEventListener("resize", refreshTiles); } catch {}
      handlers.forEach(([ev, fn]) => { try { c.off?.(ev, fn); } catch {} });
    };
  }, [clientRef, zoomRootRef, refreshParticipants, refreshTiles]);

  if (!mounted || !hostRef.current) return null;

  // ===== Render =====
  return createPortal(
    <div style={{ position: USE_FIXED_OVERLAY ? "fixed" : "absolute", inset: 0, pointerEvents: "none" }}>
      {tiles.map(({ x, y, w, h, size, count }, i) => {
        const label = count > 9 ? "9+" : String(count);
        return (
          <div key={i} style={{
            position: "absolute",
            left: Math.round(x), top: Math.round(y),
            width: Math.round(w), height: Math.round(h)
          }}>
            <div
              style={{
                position: "absolute",
                right: Math.max(4, Math.floor(size * 0.2)),
                top:   Math.max(4, Math.floor(size * 0.2)),
                width: size, height: size,
                borderRadius: Math.floor(size / 6),
                background: "rgba(255, 204, 0, 0.95)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: Math.max(12, Math.floor(size * 0.55)),
                lineHeight: 1, color: "#111",
                textShadow: "0 1px 0 rgba(255,255,255,.35)",
                boxShadow: "0 2px 10px rgba(0,0,0,.35)",
              }}
              title={`Tarjetas amarillas: ${count}`}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>,
    hostRef.current
  );
}

export default YellowCardOverlayLayer;
