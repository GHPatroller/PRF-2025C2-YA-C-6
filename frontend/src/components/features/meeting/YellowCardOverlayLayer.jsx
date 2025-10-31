import React, { useEffect, useMemo, useRef, useState } from "react";

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

export function YellowCardOverlayLayer({ zoomRootRef, clientRef, getYellowedUserIds }) {
  const containerRef = useRef(null);
  const [tiles, setTiles] = useState([]);
  const [idToName, setIdToName] = useState(new Map());
  const [nameToId, setNameToId] = useState(new Map());
  const [hostId, setHostId] = useState(null);

  // === REFRESH PARTICIPANTS FROM SDK ===
  const refreshParticipants = useMemo(
    () =>
      throttle(() => {
        const c = clientRef?.current;
        if (!c) return;
        try {
          const users = c.getAllUser?.() || [];
          const i2n = new Map();
          const n2i = new Map();
          for (const u of users) {
            const id = String(u.userId);
            const name = String(u.displayName || "").trim();
            if (id) i2n.set(id, name);
            if (name) n2i.set(name, id);
          }
          setIdToName(i2n);
          setNameToId(n2i);

          const me = c.getCurrentUserInfo?.();
          if (me?.userId != null) setHostId(String(me.userId));
        } catch {}
      }, 200),
    [clientRef]
  );

  const yellowIds = useMemo(() => {
    try { return getYellowedUserIds?.() || new Set(); } catch { return new Set(); }
  }, [getYellowedUserIds]);

  const yellowNames = useMemo(() => {
    const s = new Set();
    for (const uid of yellowIds) {
      const name = idToName.get(String(uid));
      if (name) s.add(name);
    }
    return s;
  }, [yellowIds, idToName]);

  // === RECOMPUTE TILE POSITIONS ===
  const recompute = useMemo(
    () =>
      throttle(() => {
        const root = zoomRootRef?.current;
        const overlay = containerRef?.current;
        if (!root || !overlay) return;

        const overlayRect = overlay.getBoundingClientRect();

        // Los <li class="zoom-MultiListItem-root"> son contenedores de cada video/avatar
        const nodes = Array.from(root.querySelectorAll("li.zoom-MultiListItem-root"));

        const list = nodes.map((el, idx) => {
          const r = el.getBoundingClientRect();
          const aria = el.getAttribute("aria-label") || "";
          // ej: "Octavio Baccaro's Avatar" → extraemos el nombre antes del "'s Avatar"
          const match = aria.match(/^(.+?)'s Avatar/i);
          const displayName = match ? match[1].trim() : "";

          const userId = nameToId.get(displayName) || null;

          return {
            key: userId || displayName || `tile-${idx}`,
            userId,
            displayName,
            top: r.top - overlayRect.top,
            left: r.left - overlayRect.left,
            width: r.width,
            height: r.height,
          };
        });

        setTiles(list);
      }, 120),
    [zoomRootRef, nameToId]
  );

  useEffect(() => {
    refreshParticipants();
    recompute();

    const root = zoomRootRef?.current;
    const mo = root ? new MutationObserver(() => { refreshParticipants(); recompute(); }) : null;
    mo?.observe(root, { childList: true, subtree: true, attributes: true });

    const ro = window.ResizeObserver ? new ResizeObserver(recompute) : null;
    ro?.observe(root);
    if (containerRef.current) ro?.observe(containerRef.current);

    return () => { mo?.disconnect(); ro?.disconnect(); };
  }, [zoomRootRef, recompute, refreshParticipants]);

  useEffect(() => { refreshParticipants(); recompute(); }, [yellowIds, refreshParticipants, recompute]);

  // === RENDER ===
  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 999999 }}
    >
      {tiles.map((m, idx) => {
        const isHost = hostId && m.userId && String(m.userId) === String(hostId);
        const byId = !!m.userId && yellowIds.has(String(m.userId));
        const byName = !!m.displayName && yellowNames.has(String(m.displayName));

        const show = !isHost && (byId || byName);
        if (!show) return null;

        const size = Math.max(24, Math.min(48, Math.floor(m.width * 0.12)));
        return (
          <div
            key={m.key || idx}
            style={{
              position: "absolute",
              top: Math.max(0, m.top),
              left: Math.max(0, m.left),
              width: Math.max(0, m.width),
              height: Math.max(0, m.height),
              pointerEvents: "none",
            }}
            title={`Tarjeta amarilla: ${m.displayName || m.userId || ""}`}
          >
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                width: size,
                height: size,
                background: "yellow",
                border: "2px solid #000",
                borderRadius: 6,
                boxShadow: "0 0 0 1px rgba(0,0,0,.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: Math.max(12, Math.floor(size * 0.5)),
              }}
            >
              ⚠️
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default YellowCardOverlayLayer;
