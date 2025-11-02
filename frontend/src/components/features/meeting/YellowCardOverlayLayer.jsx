// src/components/features/meeting/YellowCardOverlayLayer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MOUNT_AT_BODY = true;     // portal a <body> (evita clipping)
const USE_FIXED_OVERLAY = true; // overlay fijo a viewport

const throttle = (fn, ms = 120) => {
  let last = 0, tid;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
    else { clearTimeout(tid); tid = setTimeout(() => { last = Date.now(); fn(...args); }, ms - (now - last)); }
  };
};

export function YellowCardOverlayLayer({ zoomRootRef, clientRef, getYellowedUserIds, yellowHash }) {
  const hostRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [tiles, setTiles] = useState([]); // {x,y,w,h,size,count}

  const [idToName, setIdToName] = useState(new Map());
  const [nameToId, setNameToId] = useState(new Map());

  // Mount host
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

  // Helpers
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

  const findLabelNodeForName = (root, displayName) => {
    const name = String(displayName || "").trim().toLowerCase();
    if (!name) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (el) => {
        const tag = el.tagName;
        if (!tag || tag === "CANVAS" || tag === "VIDEO") return NodeFilter.FILTER_SKIP;
        const text = el.textContent;
        if (!text || text.length > 200) return NodeFilter.FILTER_SKIP;
        return text.trim().toLowerCase().includes(name)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });
    let node = walker.nextNode();
    while (node) {
      const st = getComputedStyle(node);
      if (st.visibility !== "hidden" && st.display !== "none") return node;
      node = walker.nextNode();
    }
    return null;
  };

  // Roster
  const refreshParticipants = useMemo(() => throttle(() => {
    const c = clientRef?.current;
    if (!c) return;
    try {
      const users = c.getAllUser?.() || c.getAttendeeslist?.() || [];
      const i2n = new Map();
      const n2i = new Map();
      users.forEach(u => {
        const uid = u?.userId ?? u?.userID ?? u?.id;
        const name = u?.displayName ?? u?.userName ?? u?.name ?? "";
        if (uid != null) {
          i2n.set(String(uid), name);
          if (name) n2i.set(String(name), String(uid));
        }
      });
      setIdToName(i2n);
      setNameToId(n2i);
    } catch {}
  }, 250), [clientRef]);

  // Tiles (usa Map id/name -> count)
  const refreshTiles = useMemo(() => throttle(() => {
    const root = zoomRootRef?.current;
    const host = hostRef.current;
    if (!root || !host) return;

    const idsMap = getYellowedUserIds?.() || new Map();     // Map<id|name, count>
    const keysWanted = new Set(idsMap instanceof Map ? Array.from(idsMap.keys()).map(String) : []);
    if (!keysWanted.size) { setTiles([]); return; }

    const countFor = (key) => {
      if (!(idsMap instanceof Map)) return 1;
      const v = idsMap.get(key);
      return Number.isFinite(v) ? v : 1;
    };

    const visualNodes = Array.from(root.querySelectorAll("canvas,video"));
    const baseRect = { left: 0, top: 0 };
    const scrollLeft = 0, scrollTop = 0;

    const matches = [];

    for (const vn of visualNodes) {
      const climbed = climbToTile(vn);
      if (!climbed) continue;
      const { rect, node: tileNode } = climbed;

      const candidates = [
        tileNode.getAttribute?.("data-userid"),
        tileNode.getAttribute?.("data-user-id"),
        tileNode.getAttribute?.("data-username"),
        tileNode.getAttribute?.("aria-label"),
        vn.getAttribute?.("data-userid"),
        vn.getAttribute?.("data-displayname"),
      ].filter(Boolean).map(String);

      let matchedKey = null;

      for (const c of candidates) {
        if (keysWanted.has(c)) { matchedKey = c; break; }
        const idFromName = nameToId.get(c);
        if (idFromName && keysWanted.has(idFromName)) { matchedKey = idFromName; break; }
      }

      if (matchedKey) {
        const x = rect.left - baseRect.left + scrollLeft;
        const y = rect.top  - baseRect.top  + scrollTop;
        const w = rect.width, h = rect.height;
        const size = Math.max(24, Math.min(w, h) * 0.25);
        matches.push({ x, y, w, h, size, count: countFor(matchedKey) });
      }
    }

    // Fallback por texto visible si no encontramos (raro pero útil)
    if (!matches.length) {
      for (const k of keysWanted) {
        const name = idToName.get(String(k)) || String(k);
        const label = findLabelNodeForName(root, name);
        if (label) {
          const climbed = climbToTile(label, 12);
          if (climbed) {
            const { rect } = climbed;
            const x = rect.left - baseRect.left + scrollLeft;
            const y = rect.top  - baseRect.top  + scrollTop;
            const w = rect.width, h = rect.height;
            const size = Math.max(24, Math.min(w, h) * 0.25);
            matches.push({ x, y, w, h, size, count: countFor(k) });
          }
        }
      }
    }

    setTiles(matches);
  }, 200), [zoomRootRef, getYellowedUserIds, nameToId, idToName]);

  // Subscriptions
  useEffect(() => {
    const c = clientRef?.current;
    const root = zoomRootRef?.current;
    if (!c || !root) return;

    const handlers = [
      ["user-added", refreshParticipants],
      ["user-removed", refreshParticipants],
      ["user-updated", refreshParticipants],
      ["active-speaker", refreshTiles],
      ["video-active-change", refreshTiles],
      ["room-change", () => { refreshParticipants(); refreshTiles(); }],
      ["meeting-status", () => { refreshParticipants(); refreshTiles(); }],
    ];
    handlers.forEach(([ev, fn]) => { try { c.on?.(ev, fn); } catch {} });

    const ro = new ResizeObserver(refreshTiles);
    try { ro.observe(root); } catch {}

    const mo = new MutationObserver(refreshTiles);
    try { mo.observe(root, { childList: true, subtree: true, attributes: true }); } catch {}

    const onScroll = throttle(refreshTiles, 120);
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
  }, [clientRef, zoomRootRef, refreshParticipants, refreshTiles, yellowHash]);

  if (!mounted || !hostRef.current) return null;

  return createPortal(
    <div style={{ position: USE_FIXED_OVERLAY ? "fixed" : "absolute", inset: 0, pointerEvents: "none" }}>
      {tiles.map(({ x, y, w, h, size, count }, i) => {
        const badge = Math.max(1, Math.min(99, Number(count) || 1));
        const label = badge > 9 ? "9+" : String(badge);
        return (
          <div key={i} style={{ position: "absolute", left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(h) }}>
            <div
              style={{
                position: "absolute",
                right: Math.max(4, Math.floor(size * 0.2)),
                top: Math.max(4, Math.floor(size * 0.2)),
                width: size,
                height: size,
                borderRadius: Math.floor(size / 6),
                background: "rgba(255, 204, 0, 0.95)", // amarillo
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: Math.max(12, Math.floor(size * 0.55)),
                lineHeight: 1,
                color: "#111",
                textShadow: "0 1px 0 rgba(255,255,255,.35)",
                boxShadow: "0 2px 10px rgba(0,0,0,.35)",
              }}
              title={`Tarjetas amarillas: ${badge}`}
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
