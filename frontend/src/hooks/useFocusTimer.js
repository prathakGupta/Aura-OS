// src/hooks/useFocusTimer.js
// Feature 3: Focus Anchor + Body Double system.
//
// Two mechanisms:
//  1. Brown Noise – HTML5 Audio loops /brown-noise.mp3 while task is active.
//     User can toggle it on/off. Helps ADHD focus (scientifically backed).
//
//  2. Body Double – Uses the Page Visibility API (document.visibilityState).
//     If user switches tabs while a task is active for more than THRESHOLD_MS,
//     fire the onDistracted callback so the UI shows the SVG avatar warning.

import { useRef, useState, useCallback, useEffect } from 'react';
import useStore from '../store/useStore.js';

const THRESHOLD_MS = 8_000; // 8 seconds away = trigger body double

export default function useFocusTimer({ isTaskActive, onDistracted, onReturned }) {
  const [noiseEnabled, setNoiseEnabled] = useState(false);
  const audioRef         = useRef(null);
  const hiddenAtRef      = useRef(null);
  const distractedRef    = useRef(false);
  const { audioMuted, isAuraSpeaking } = useStore();

  // ── Brown noise setup ──────────────────────────────────────────────────────
  useEffect(() => {
    const audio = new Audio('/brown-noise.mp3');
    audio.loop = true;
    audio.volume = 0.35;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Control playback based on task active state + user toggle
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audioMuted && isTaskActive && noiseEnabled) {
      audio.play().catch(() => {}); // autoplay policies – silent fail is fine
    } else {
      audio.pause();
    }
  }, [isTaskActive, noiseEnabled, audioMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // Lower background noise while Aura voice is speaking to avoid overlap fatigue.
    audio.volume = isAuraSpeaking ? 0.08 : 0.35;
  }, [isAuraSpeaking]);

  const toggleNoise = useCallback(() => {
    setNoiseEnabled((prev) => !prev);
  }, []);

  // ── Body Double (Visibility API) ───────────────────────────────────────────
  useEffect(() => {
    if (!isTaskActive) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
      } else {
        // User came back
        const elapsed = Date.now() - (hiddenAtRef.current || Date.now());
        hiddenAtRef.current = null;

        if (distractedRef.current) {
          distractedRef.current = false;
          onReturned?.();
        } else if (elapsed >= THRESHOLD_MS) {
          // They came back but we haven't shown the alert yet
          distractedRef.current = true;
          onDistracted?.();
          // Reset after callback
          setTimeout(() => {
            distractedRef.current = false;
          }, 100);
        }
      }
    };

    // Check every 2s if user has been hidden long enough
    const interval = setInterval(() => {
      if (
        document.visibilityState === 'hidden' &&
        hiddenAtRef.current &&
        !distractedRef.current &&
        Date.now() - hiddenAtRef.current >= THRESHOLD_MS
      ) {
        distractedRef.current = true;
        onDistracted?.();
      }
    }, 2000);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
      hiddenAtRef.current = null;
      distractedRef.current = false;
    };
  }, [isTaskActive, onDistracted, onReturned]);

  return { noiseEnabled, toggleNoise };
}
