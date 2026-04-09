# backend-python/app/core/transcriber.py
import warnings

import numpy as np
from transformers import pipeline

warnings.filterwarnings("ignore")
transcriber = None
_transcriber_init_attempted = False


def _get_transcriber():
    global transcriber, _transcriber_init_attempted
    if transcriber is not None:
        return transcriber
    if _transcriber_init_attempted:
        return None

    _transcriber_init_attempted = True
    try:
        transcriber = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en")
    except Exception as e:
        print(f"⚠️ Warning: Transcriber failed to load: {e}")
        transcriber = None
    return transcriber


def transcribe_audio(audio_np: np.ndarray, sample_rate: int = 16000) -> str:
    local_transcriber = _get_transcriber()
    if local_transcriber is None:
        return ""

    if audio_np is None or audio_np.size < int(sample_rate * 0.4):
        return ""

    try:
        result = local_transcriber(
            {
                "raw": np.asarray(audio_np, dtype=np.float32),
                "sampling_rate": sample_rate,
            }
        )
        return str(result.get("text", "")).strip()
    except Exception:
        return ""
