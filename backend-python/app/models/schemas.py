from __future__ import annotations

from pydantic import BaseModel, Field


class AudioStressRequest(BaseModel):
    stress_score: float = Field(..., ge=0.0, le=1.0)


class AudioStressResponse(BaseModel):
    stress_score: float
    label: str


class TaskShatterRequest(BaseModel):
    task: str = Field(..., min_length=1)


class TaskShatterResponse(BaseModel):
    steps: list[str]

