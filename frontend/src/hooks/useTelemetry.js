// src/hooks/useTelemetry.js  🌟 NEW
// Silently logs Passive Somatic Telemetry as the user interacts with the app.
// Catches vocal stress events forwarded from Aura Voice and mouse kinetics
// from the Shattered Canvas (erratic drag = stress signal).

import { useRef, useCallback } from "react";
import useStore from "../store/useStore.js";
import { clinicalApi } from "../services/portalApi.js";

export default function useTelemetry() {
  const { userId, auraEmotion } = useStore();
  const lastLoggedRef = useRef(null);
  const dragEventRef  = useRef([]);  // [ {vx, vy, timestamp} ]

  // ── Log a vocal stress event (called from useAudioStream after each session) ──
  const logVocalStress = useCallback(async ({ arousalScore, emotion, taskContext }) => {
    if (!userId) return;
    const now = Date.now();
    // Debounce: don't log more than once per 30s
    if (lastLoggedRef.current && now - lastLoggedRef.current < 30_000) return;
    lastLoggedRef.current = now;

    try {
      await fetch("/api/clinical/vocal-stress", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId, emotion, arousalScore, taskContext }),
      });
    } catch { /* non-critical, silent */ }
  }, [userId]);

  // ── Record a drag event from the Shattered Canvas ────────────────────────
  // Called from FragmentCard onDragEnd with velocity info
  const recordDragEvent = useCallback((velocityX, velocityY) => {
    const speed = Math.sqrt(velocityX ** 2 + velocityY ** 2);
    dragEventRef.current.push({ speed, timestamp: Date.now() });
    // Keep last 20 drag events only
    if (dragEventRef.current.length > 20) dragEventRef.current.shift();
  }, []);

  // ── Analyse drag kinetics → return stress score 1-10 ─────────────────────
  // High velocity + high variance = agitation (elevated stress)
  const getDragStressScore = useCallback(() => {
    const events = dragEventRef.current;
    if (events.length < 3) return null;
    const avg     = events.reduce((s, e) => s + e.speed, 0) / events.length;
    const maxSpeed= Math.max(...events.map(e => e.speed));
    // Normalise to 1–10
    const score   = Math.min(10, Math.max(1, Math.round(avg / 50)));
    return { score, maxSpeed, sampleSize: events.length };
  }, []);

  return { logVocalStress, recordDragEvent, getDragStressScore };
}