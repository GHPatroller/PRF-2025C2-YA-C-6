import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { useZoomClient } from "./hooks/useZoomClient";
import { useUserManagement } from "./hooks/useUserManagement";
import { MeetingControls } from "./components/features/meeting/MeetingControls";
import { YellowCardOverlayLayer } from "./components/features/meeting/YellowCardOverlayLayer";

export default function ZoomMeeting() {
  const zoomRef = useRef(null);
  const clientRef = useZoomClient(zoomRef);

  const [isRecreo, setIsRecreo] = useState(false);
  const [isMicPaused, setIsMicPaused] = useState(false);

  const {
    waitingUsers,
    createAndJoinMeeting,
    admitOnHold,
    sendToOnHold,
    scoreboard,
    cardSystem,
  } = useUserManagement(clientRef, {
    pauseCameraRule: isRecreo,
    pauseMicRule: isMicPaused,
  });

  // === Devuelve Map<idOrName, count> para overlay ===
  const getYellowedUserIds = useCallback(() => {
    try {
      if (typeof window !== "undefined" && window.TEST_YELLOW_NAME) {
        return new Map([[String(window.TEST_YELLOW_NAME), 1]]);
      }

      const roster =
        clientRef.current?.getAllUser?.() ||
        clientRef.current?.getAttendeeslist?.() ||
        [];
      const nameToId = new Map();
      roster.forEach((u) => {
        const uid = u?.userId ?? u?.userID ?? u?.id;
        const name = u?.displayName ?? u?.userName ?? u?.name;
        if (uid != null && name) nameToId.set(String(name), String(uid));
      });

      const yMap =
        cardSystem?.yellowByKeyRef?.current ??
        cardSystem?.yellowByKeyMap?.current ??
        cardSystem?.yellowByKeyMap ??
        cardSystem?.yellowByKey ??
        new Map();

      const k2id =
        cardSystem?.keyToLastUserIdRef?.current ??
        cardSystem?.keyToLastUserIdRef ??
        cardSystem?.keyToLastUserId ??
        new Map();

      const nameToKey =
        cardSystem?.nameToKeyRef?.current ??
        cardSystem?.nameToKeyRef ??
        cardSystem?.nameToKey ??
        new Map();

      const result = new Map();

      for (const [key, count] of yMap.entries()) {
        if (!count || count <= 0) continue;
        const sKey = String(key);

        const uid = k2id?.get?.(sKey);
        if (uid != null) {
          result.set(String(uid), count);
          continue;
        }

        let mappedName = null;
        for (const [name, mappedKey] of nameToKey.entries()) {
          if (String(mappedKey) === sKey) {
            mappedName = String(name);
            break;
          }
        }
        if (mappedName) {
          const liveId = nameToId.get(mappedName);
          result.set(liveId ? liveId : mappedName, count);
          continue;
        }

        const liveId = nameToId.get(sKey);
        result.set(liveId ? liveId : sKey, count);
      }

      return result; // Map<idOrName, count>
    } catch {
      return new Map();
    }
  }, [clientRef, cardSystem]);

  const yellowHash = useMemo(() => {
    try {
      const arr = Array.from(getYellowedUserIds()?.entries() || []);
      arr.sort(([a], [b]) => a.localeCompare(b));
      return arr.map(([id, c]) => `${id}:${c}`).join("|");
    } catch {
      return "";
    }
  }, [getYellowedUserIds, scoreboard, cardSystem]);

  // Limpio, sin logs de debug
  useEffect(() => {
    window.__CARD = cardSystem || null;
    window.__ROSTER = () =>
      clientRef.current?.getAllUser?.() ||
      clientRef.current?.getAttendeeslist?.() ||
      [];
  }, [cardSystem, clientRef]);

  return (
    <div style={{ padding: 16 }}>
      <MeetingControls
        onCreateJoin={createAndJoinMeeting}
        onSendToWaiting={() => sendToOnHold()}
        onAdmitFromWaiting={() => admitOnHold()}
        waitingUsersCount={waitingUsers?.length || 0}
        isRecreo={isRecreo}
        isMicPaused={isMicPaused}
        onToggleRecreo={() => setIsRecreo((v) => !v)}
        onToggleMicPaused={() => setIsMicPaused((v) => !v)}
      />

      <div
        style={{
          position: "relative",
          width: 800,
          height: 450,
          margin: "20px auto 0",
          background: "#000",
        }}
      >
        <div ref={zoomRef} style={{ position: "absolute", inset: 0 }} />
        <YellowCardOverlayLayer
          zoomRootRef={zoomRef}
          clientRef={clientRef}
          getYellowedUserIds={getYellowedUserIds}
          yellowHash={yellowHash}
        />
      </div>
    </div>
  );
}
