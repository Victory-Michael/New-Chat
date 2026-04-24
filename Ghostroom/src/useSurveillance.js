import { useEffect, useRef } from "react";
import { logSurveillance } from "./firebase";

/**
 * useSurveillance
 * Attaches visibility + screenshot detection for a room.
 * Only runs when the user is actively in the room.
 */
export default function useSurveillance(roomId, uid, handle, enabled = true) {
  const lastTabOut = useRef(0);

  useEffect(() => {
    if (!roomId || !uid || !handle || !enabled) return;

    /* ── visibilitychange → tab-out log ─────────────────── */
    const handleVisibility = () => {
      if (document.hidden) {
        const now = Date.now();
        // Debounce: only log once every 10 seconds
        if (now - lastTabOut.current > 10_000) {
          lastTabOut.current = now;
          logSurveillance(roomId, uid, handle, "tab-out");
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    /* ── Screenshot detection ────────────────────────────── */
    // Method 1: keyboard shortcut detection (Print Screen, Cmd+Shift+3/4 on mac)
    const handleKeyDown = (e) => {
      const isPrintScreen = e.key === "PrintScreen";
      const isMacScreenshot =
        (e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5"));
      const isWindowsSnip =
        (e.metaKey && e.shiftKey && e.key === "s") ||
        (e.key === "PrintScreen");

      if (isPrintScreen || isMacScreenshot || isWindowsSnip) {
        logSurveillance(roomId, uid, handle, "screenshot");
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    /* ── Screen capture API detection ───────────────────── */
    // If the browser supports getDisplayMedia, we detect when it's used
    const originalGetDisplayMedia =
      navigator.mediaDevices?.getDisplayMedia?.bind(navigator.mediaDevices);
    if (originalGetDisplayMedia && navigator.mediaDevices) {
      navigator.mediaDevices.getDisplayMedia = async (...args) => {
        logSurveillance(roomId, uid, handle, "recording");
        return originalGetDisplayMedia(...args);
      };
    }

    /* ── Focus regain heuristic (window blur = possible screenshot) ─ */
    let blurTime = 0;
    const handleBlur  = () => { blurTime = Date.now(); };
    const handleFocus = () => {
      // If focus was gone for < 2s, likely a system screenshot dialog
      if (blurTime && Date.now() - blurTime < 2000) {
        logSurveillance(roomId, uid, handle, "screenshot");
      }
      blurTime = 0;
    };
    window.addEventListener("blur",  handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur",  handleBlur);
      window.removeEventListener("focus", handleFocus);
      // Restore original getDisplayMedia
      if (originalGetDisplayMedia && navigator.mediaDevices) {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      }
    };
  }, [roomId, uid, handle, enabled]);
}