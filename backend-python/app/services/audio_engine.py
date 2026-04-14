from __future__ import annotations

from dataclasses import dataclass
import numpy as np


@dataclass(frozen=True)
class StressResult:
    stress_score: float
    label: str


@dataclass(frozen=True)
class AudioFeatures:
    rms: float
    zero_crossing_rate: float
    pitch_score: float
    cadence_score: float
    stress_score: float
    emotion: str


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _emotion_from_stress(stress_score: float) -> str:
    if stress_score >= 0.72:
        return "high_anxiety"
    if stress_score >= 0.42:
        return "mild_anxiety"
    return "calm"


def detect_vocal_stress(*, stress_score: float) -> StressResult:
    safe_score = _clamp(float(stress_score))
    label = _emotion_from_stress(safe_score)
    return StressResult(stress_score=safe_score, label=label)


def analyze_audio_chunk(samples: np.ndarray) -> AudioFeatures:
    if samples.size == 0:
        return AudioFeatures(
            rms=0.0,
            zero_crossing_rate=0.0,
            pitch_score=0.0,
            cadence_score=0.0,
            stress_score=0.0,
            emotion="calm",
        )

    wave = np.asarray(samples, dtype=np.float32).flatten()
    rms = float(np.sqrt(np.mean(np.square(wave))))
    zero_crossing_rate = float(np.mean(np.abs(np.diff(np.signbit(wave)))))

    pitch_score = _clamp((rms - 0.008) / 0.06)
    cadence_score = _clamp((zero_crossing_rate - 0.03) / 0.25)
    stress_score = _clamp((pitch_score * 0.62) + (cadence_score * 0.38))
    emotion = _emotion_from_stress(stress_score)

    return AudioFeatures(
        rms=rms,
        zero_crossing_rate=zero_crossing_rate,
        pitch_score=round(pitch_score, 4),
        cadence_score=round(cadence_score, 4),
        stress_score=round(stress_score, 4),
        emotion=emotion,
    )


def arousal_from_stress(stress_score: float) -> float:
    return round(1.0 + (_clamp(stress_score) * 9.0), 2)
