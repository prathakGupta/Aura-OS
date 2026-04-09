# backend-python/app/core/transcriber.py
import warnings

import numpy as np
from transformers import pipeline

warnings.filterwarnings("ignore")
transcriber = None
try:
    transcriber = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en")
except Exception as e:
    print(f"⚠️ Warning: Transcriber failed to load: {e}")


def transcribe_audio(audio_np: np.ndarray, sample_rate: int = 16000) -> str:
    if transcriber is None:
        return ""

    if audio_np is None or audio_np.size < int(sample_rate * 0.4):
        return ""

    try:
        result = transcriber(
            {
                "raw": np.asarray(audio_np, dtype=np.float32),
                "sampling_rate": sample_rate,
            }
        )
        return str(result.get("text", "")).strip()
    except Exception:
        return ""
