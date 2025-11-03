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
  const [nameToId, setNameToId] = useState(new Map());

  // Mount del host del overlay
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

  // Helpers DOM
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

  // Roster (para mapear id<->nombre como fallback)
const refreshParticipants = useMemo(
  () =>
    throttle(() => {
      const c = clientRef?.current;
      if (!c) return;
      try {
        // ✅ Meeting SDK: usar getAllUser() / getAttendeeslist()
        const list =
          c.getAllUser?.() ||
          c.getAttendeeslist?.() ||
          [];

        const i2n = new Map();
        const n2i = new Map();
        list.forEach((u) => {
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
    }, 250),
  [clientRef]
);


  // Recalcular los tiles con amarillas (usa cardSystem.getYellowByUserId)
  const refreshTiles = useMemo(
    () =>
      throttle(async () => {
        const root = zoomRootRef?.current;
        const host = hostRef.current;
        if (!root || !host || !cardSystem?.getYellowByUserId) {
          setTiles([]);
          return;
        }

        // Map<userId, count>
        const yMap = await cardSystem.getYellowByUserId();
        const ids = Array.from(yMap.keys()).map(String);
        if (!ids.length) {
          setTiles([]);
          return;
        }

        const visualNodes = Array.from(root.querySelectorAll("canvas,video"));
        const matches = [];

        const matchOne = (userId, count) => {
          // 1) Por atributos
          const attrSel = [
            `[data-userid="${userId}"]`,
            `li[data-userid="${userId}"]`,
          ];
          let tileNode = null;
          for (const sel of attrSel) {
            const el = root.querySelector(sel);
            if (el) { tileNode = el; break; }
          }

          // 2) Por nombre visible (fallback)
          if (!tileNode) {
            const displayName = idToName.get(String(userId));
            if (displayName) {
              const label = findLabelNodeForName(root, displayName);
              if (label) {
                const climbed = climbToTile(label, 12);
                if (climbed) tileNode = climbed.node;
              }
            }
          }

          if (!tileNode) return;

          const climbed = climbToTile(tileNode, 12);
          if (!climbed) return;
          const { rect } = climbed;

          const w = rect.width, h = rect.height;
          const x = rect.left;
          const y = rect.top;
          const size = Math.max(24, Math.min(w, h) * 0.25);

          matches.push({
            x, y, w, h,
            size,
            count: Number.isFinite(count) ? count : 1,
          });
        };

        ids.forEach((uid) => matchOne(uid, yMap.get(uid)));

        setTiles(matches);
      }, 180),
    [zoomRootRef, cardSystem, idToName]
  );

  // Subscriptions
  useEffect(() => {
    const c = clientRef?.current;
    const root = zoomRootRef?.current;
    if (!c || !root) return;

    const handlers = [
      ["user-added", refreshParticipants],
      ["user-removed", refreshParticipants],
      ["user-updated", () => { refreshParticipants(); refreshTiles(); }],
      ["active-speaker", refreshTiles],
      ["video-active-change", refreshTiles],
      ["room-change", () => { refreshParticipants(); refreshTiles(); }],
      ["meeting-status", () => { refreshParticipants(); refreshTiles(); }],
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

  // Render overlay
  const body = (
    <div style={{ position: USE_FIXED_OVERLAY ? "fixed" : "absolute", inset: 0, pointerEvents: "none" }}>
      {tiles.map(({ x, y, w, h, size, count }, i) => {
        const badge = Math.max(1, Math.min(99, Number(count) || 1));
        const label = badge > 9 ? "9+" : String(badge);
        return (
          <div key={i} style={{
            position: "absolute",
            left: Math.round(x),
            top: Math.round(y),
            width: Math.round(w),
            height: Math.round(h)
          }}>
            <div
              style={{
                position: "absolute",
                right: Math.max(4, Math.floor(size * 0.2)),
                top: Math.max(4, Math.floor(size * 0.2)),
                width: size,
                height: size,
                borderRadius: Math.floor(size / 6),
                background: "rgba(255, 204, 0, 0.95)",
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
    </div>
  );

  return createPortal(body, hostRef.current);
}

export default YellowCardOverlayLayer;
