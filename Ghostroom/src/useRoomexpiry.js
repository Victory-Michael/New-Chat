import { useEffect, useState, useRef, useCallback } from "react";
import { purgeRoom } from "./firebase";

/**
 * useRoomExpiry
 * Returns: { secondsLeft, phase }
 *   phase: "normal" | "glitch" | "countdown" | "dead"
 *
 * At 60s → phase = "glitch"  (CSS glitch animation)
 * At 10s → phase = "countdown" (visible number overlay)
 * At  0s → purgeRoom() + onExpire() callback
 */
export default function useRoomExpiry(room, onExpire) {
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [phase,       setPhase]       = useState("normal");
  const purgedRef                     = useRef(false);

  const computeSeconds = useCallback(() => {
    if (!room?.expiresAt) return null;
    const expTs = room.expiresAt.toDate
      ? room.expiresAt.toDate()
      : new Date(room.expiresAt.seconds * 1000);
    return Math.max(0, Math.floor((expTs.getTime() - Date.now()) / 1000));
  }, [room]);

  useEffect(() => {
    if (!room) return;
    const tick = () => {
      const s = computeSeconds();
      if (s === null) return;
      setSecondsLeft(s);

      if      (s <= 0)  setPhase("dead");
      else if (s <= 10) setPhase("countdown");
      else if (s <= 60) setPhase("glitch");
      else              setPhase("normal");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [computeSeconds]);

  // Trigger purge exactly once when phase hits "dead"
  useEffect(() => {
    if (phase === "dead" && !purgedRef.current && room?.id) {
      purgedRef.current = true;
      purgeRoom(room.id).finally(() => {
        setTimeout(() => onExpire?.(), 400);
      });
    }
  }, [phase, room?.id, onExpire]);

  return { secondsLeft, phase };
}

/** Format seconds as MM:SS */
export function fmtTime(s) {
  if (s === null || s === undefined) return "--:--";
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  if (h > 0) return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sc).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(sc).padStart(2,"0")}`;
}