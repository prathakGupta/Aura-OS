// src/hooks/useAudioStream.js
// Feature 1: Manages the full audio pipeline for AuraVoice.
//
// Responsibilities:
//  1. getUserMedia → capture mic
//  2. Web Audio API → AnalyserNode for the visualizer canvas
//  3. ScriptProcessorNode → chunk PCM audio → WebSocket → Python backend
//  4. Receive JSON messages from Python: transcript | response | emotion_update
//  5. Receive TTS audio (base64) → decode → play back

import { useRef, useCallback, useEffect } from 'react';
import useStore from '../store/useStore.js';

const isBrowser = typeof window !== 'undefined';

const toWsProtocol = (protocol) => (protocol === 'https:' ? 'wss:' : 'ws:');

const resolveWsUrl = (userId) => {
  if (!isBrowser) return null;

  // Optional override for production: VITE_AUDIO_WS_URL=ws://host:8000/ws/audio
  const fromEnv = (import.meta.env.VITE_AUDIO_WS_URL || '').trim();
  if (fromEnv) {
    const joiner = fromEnv.includes('?') ? '&' : '?';
    return `${fromEnv}${joiner}userId=${encodeURIComponent(userId || '')}`;
  }

  // Default path uses Vite proxy in dev and reverse-proxy in production.
  const wsProtocol = toWsProtocol(window.location.protocol);
  return `${wsProtocol}//${window.location.host}/ws/audio?userId=${encodeURIComponent(userId || '')}`;
};

const BUFFER_SIZE = 4096;
const SAMPLE_RATE = 16000; // Whisper expects 16kHz

export default function useAudioStream() {
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const animFrameRef = useRef(null);
  const ttsSourceRef = useRef(null);
  const audioMutedRef = useRef(false);

  const {
    userId,
    setListening,
    setAuraEmotion,
    setAuraTranscript,
    setAuraResponse,
    audioMuted,
    setAuraSpeaking,
  } = useStore();

  useEffect(() => {
    audioMutedRef.current = audioMuted;
    if (audioMuted && ttsSourceRef.current) {
      try { ttsSourceRef.current.stop(0); } catch (_) {}
      ttsSourceRef.current = null;
      setAuraSpeaking(false);
    }
  }, [audioMuted, setAuraSpeaking]);

  // ── Teardown helper ────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    try {
      if (processorRef.current) {
        try {
          processorRef.current.disconnect();
        } catch (_) {}
      }

      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch (_) {}
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }

      if (wsRef.current && (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      )) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.onmessage = null;
          wsRef.current.close();
        } catch (_) {}
      }

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }

      if (ttsSourceRef.current) {
        try {
          ttsSourceRef.current.stop(0);
        } catch (_) {}
      }
    } finally {
      processorRef.current = null;
      analyserRef.current = null;
      streamRef.current = null;
      audioCtxRef.current = null;
      wsRef.current = null;
      animFrameRef.current = null;
      ttsSourceRef.current = null;
      setAuraSpeaking(false);
      setListening(false);
    }
  }, [setListening, setAuraSpeaking]);

  // ── Draw visualizer on canvas ──────────────────────────────────────────────
  const drawVisualizer = useCallback((canvas, analyser) => {
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barCount = 48;
      const barWidth = (width / barCount) * 0.6;
      const gap = (width / barCount) * 0.4;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * (bufferLength / 2));
        const value = dataArray[dataIndex] / 255;
        const barHeight = value * height * 0.85;

        const x = i * (barWidth + gap) + gap / 2;
        const y = height - barHeight;

        const r = Math.round(124 + (13 - 124) * value);
        const g = Math.round(58 + (148 - 58) * value);
        const b = Math.round(237 + (136 - 237) * value);

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.globalAlpha = 0.7 + value * 0.3;

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, barHeight, 3);
        } else {
          const radius = Math.min(3, barWidth / 2, barHeight / 2);
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + barWidth - radius, y);
          ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
          ctx.lineTo(x + barWidth, y + barHeight - radius);
          ctx.quadraticCurveTo(
            x + barWidth,
            y + barHeight,
            x + barWidth - radius,
            y + barHeight
          );
          ctx.lineTo(x + radius, y + barHeight);
          ctx.quadraticCurveTo(x, y + barHeight, x, y + barHeight - radius);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
        }

        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    draw();
  }, []);

  // ── Start listening ────────────────────────────────────────────────────────
  const start = useCallback(
    async (visualizerCanvas) => {
      try {
        const wsUrl = resolveWsUrl(userId);
        if (!isBrowser || !wsUrl) {
          throw new Error('Audio stream can only start in a browser environment.');
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Microphone access is not supported in this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error('Web Audio API is not supported in this browser.');
        }

        const audioCtx = new AudioContextClass({ sampleRate: SAMPLE_RATE });
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        // Wire up visualizer
        source.connect(analyser);
        drawVisualizer(visualizerCanvas, analyser);

        // ScriptProcessor chunks audio for WebSocket transmission
        const processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
        processorRef.current = processor;
        source.connect(processor);

        // Keep processor alive without loud audio output
        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;
        processor.connect(silentGain);
        silentGain.connect(audioCtx.destination);

        // ── WebSocket connection ──────────────────────────────────────────────
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
          console.log('[WS] Connected to Python audio backend');
          setListening(true);
        };

        ws.onmessage = async (event) => {
          try {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
              case 'transcript':
                setAuraTranscript(msg.text || '');
                break;

              case 'response':
                setAuraResponse(msg.text || '');
                if (msg.emotion) setAuraEmotion(msg.emotion);

                if (typeof msg.tts_audio === 'string' && msg.tts_audio && audioCtxRef.current && !audioMutedRef.current) {
                  try {
                    if (ttsSourceRef.current) {
                      try { ttsSourceRef.current.stop(0); } catch (_) {}
                      ttsSourceRef.current = null;
                    }

                    const binary = atob(msg.tts_audio);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) {
                      bytes[i] = binary.charCodeAt(i);
                    }

                    const audioBuffer = await audioCtxRef.current.decodeAudioData(
                      bytes.buffer
                    );
                    const ttsSource = audioCtxRef.current.createBufferSource();
                    ttsSource.buffer = audioBuffer;
                    ttsSource.connect(audioCtxRef.current.destination);
                    ttsSource.onended = () => {
                      if (ttsSourceRef.current === ttsSource) ttsSourceRef.current = null;
                      setAuraSpeaking(false);
                    };
                    ttsSourceRef.current = ttsSource;
                    setAuraSpeaking(true);
                    ttsSource.start();
                  } catch (e) {
                    setAuraSpeaking(false);
                    console.warn('[WS] TTS playback failed:', e?.message || e);
                  }
                }
                break;

              case 'emotion_update':
                setAuraEmotion(msg.emotion || '');
                break;

              default:
                break;
            }
          } catch (e) {
            console.warn('[WS] Invalid message received:', e);
          }
        };

        ws.onerror = () => {
          console.error(
            '[WS] Could not connect to the voice backend. Is the Python service running on :8000?'
          );
          stop();
        };

        ws.onclose = () => {
          console.log('[WS] Disconnected');
          stop();
        };

        processor.onaudioprocess = (event) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const float32 = event.inputBuffer.getChannelData(0);
          ws.send(float32.buffer);
        };
      } catch (err) {
        console.error('[AudioStream] Failed to start:', err);
        stop();
        throw err;
      }
    },
    [
      drawVisualizer,
      stop,
      setListening,
      setAuraEmotion,
      setAuraTranscript,
      setAuraResponse,
      setAuraSpeaking,
      userId,
    ]
  );

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  return { start, stop, analyserRef };
}
