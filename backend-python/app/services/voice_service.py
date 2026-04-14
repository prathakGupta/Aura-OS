from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from app.core.config import settings
from app.services.audio_engine import analyze_audio_chunk, arousal_from_stress
from app.services.node_bridge import post_vocal_stress_event

SILENCE_CHUNKS_TO_CLOSE_UTTERANCE = 6
EMOTION_UPDATE_INTERVAL_SECONDS = 0.75
MAX_BUFFER_SECONDS = 12

EMOTION_RESPONSES = {
    "calm": "I hear you. Keep speaking at your pace, one thought at a time.",
    "mild_anxiety": "You are carrying a lot. Inhale for four counts, then exhale slowly.",
    "high_anxiety": "You're safe right now. Feel your feet on the ground and name three things you can see.",
}

EMOTION_TRANSCRIPTS = {
    "calm": "I am talking through what I feel.",
    "mild_anxiety": "I feel anxious and need a small reset.",
    "high_anxiety": "I feel overwhelmed right now.",
}


@dataclass
class VoiceSession:
    user_id: str | None = None
    task_context: str | None = None
    sample_rate: int = settings.VOICE_SAMPLE_RATE
    vad_threshold: float = settings.VOICE_VAD_THRESHOLD
    speech_chunks: list[np.ndarray] = field(default_factory=list)
    is_speaking: bool = False
    silence_chunks: int = 0
    last_emotion: str = "calm"
    last_emotion_emit: float = 0.0
    pending_vocal_stress_event: dict[str, Any] | None = None

    def process_chunk(self, payload: bytes) -> list[dict[str, Any]]:
        if not payload:
            return []

        try:
            samples = np.frombuffer(payload, dtype=np.float32)
        except ValueError:
            return []

        if samples.size == 0:
            return []

        features = analyze_audio_chunk(samples)
        messages: list[dict[str, Any]] = []
        now = time.monotonic()

        should_emit_emotion = (
            features.emotion != self.last_emotion
            or (now - self.last_emotion_emit) >= EMOTION_UPDATE_INTERVAL_SECONDS
        )
        if should_emit_emotion:
            messages.append(
                {
                    "type": "emotion_update",
                    "emotion": features.emotion,
                    "pitch_score": features.pitch_score,
                    "cadence_score": features.cadence_score,
                    "arousal_score": getattr(features, 'arousal_score', 5.0),
                    "confidence": getattr(features, 'confidence', 0.0),
                    "jitter": getattr(features, 'jitter', 0.0),
                    "shimmer": getattr(features, 'shimmer', 0.0),
                    "hnr": getattr(features, 'hnr', 0.0),
                    "f0_mean": getattr(features, 'f0_mean', 0.0),
                }
            )
            self.last_emotion = features.emotion
            self.last_emotion_emit = now

        if features.rms >= self.vad_threshold:
            self.is_speaking = True
            self.silence_chunks = 0
            self.speech_chunks.append(np.array(samples, copy=True))
            self._trim_buffer()
            return messages

        if not self.is_speaking:
            return messages

        self.silence_chunks += 1
        if self.silence_chunks >= SILENCE_CHUNKS_TO_CLOSE_UTTERANCE:
            messages.extend(self._finish_utterance())
            self.is_speaking = False
            self.silence_chunks = 0
            self.speech_chunks.clear()

        return messages

    def flush_pending_event(self) -> None:
        if not self.pending_vocal_stress_event:
            return

        payload = self.pending_vocal_stress_event
        self.pending_vocal_stress_event = None
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(post_vocal_stress_event(**payload))

    def _trim_buffer(self) -> None:
        max_samples = self.sample_rate * MAX_BUFFER_SECONDS
        total_samples = int(sum(chunk.size for chunk in self.speech_chunks))
        if total_samples <= max_samples:
            return

        merged = np.concatenate(self.speech_chunks)
        keep_tail = merged[-max_samples:]
        self.speech_chunks = [keep_tail]

    def _finish_utterance(self) -> list[dict[str, Any]]:
        if not self.speech_chunks:
            return []

        merged = np.concatenate(self.speech_chunks)
        features = analyze_audio_chunk(merged)
        arousal_score = arousal_from_stress(features.stress_score)
        utterance_seconds = round(float(merged.size / self.sample_rate), 2)

        transcript = self._build_transcript(features.emotion, utterance_seconds)
        response = EMOTION_RESPONSES[features.emotion]

        self.pending_vocal_stress_event = {
            "user_id": self.user_id,
            "emotion": features.emotion,
            "arousal_score": arousal_score,
            "task_context": self.task_context,
        }
        self.flush_pending_event()

        return [
            {"type": "transcript", "text": transcript},
            {
                "type": "response",
                "text": response,
                "emotion": features.emotion,
                "arousal_score": getattr(features, 'arousal_score', arousal_score),
                "confidence": getattr(features, 'confidence', 0.0),
            },
            {
                "type": "emotion_update",
                "emotion": features.emotion,
                "pitch_score": features.pitch_score,
                "cadence_score": features.cadence_score,
                "arousal_score": getattr(features, 'arousal_score', arousal_score),
                "confidence": getattr(features, 'confidence', 0.0),
                "jitter": getattr(features, 'jitter', 0.0),
                "shimmer": getattr(features, 'shimmer', 0.0),
                "hnr": getattr(features, 'hnr', 0.0),
                "f0_mean": getattr(features, 'f0_mean', 0.0),
            },
        ]

    @staticmethod
    def _build_transcript(emotion: str, utterance_seconds: float) -> str:
        template = EMOTION_TRANSCRIPTS.get(emotion, EMOTION_TRANSCRIPTS["calm"])
        return f"{template} (voice segment: {utterance_seconds}s)"
