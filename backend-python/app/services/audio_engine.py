from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class StressResult:
    stress_score: float
    label: str


def detect_vocal_stress(*, stress_score: float) -> StressResult:
    label = "high" if stress_score >= 0.7 else "medium" if stress_score >= 0.4 else "low"
    return StressResult(stress_score=stress_score, label=label)

