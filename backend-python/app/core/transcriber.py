# backend-python/app/core/transcriber.py
import os
import tempfile
import warnings
from transformers import pipeline

warnings.filterwarnings("ignore")
try:
    transcriber = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en")
except Exception as e:
    print(f"⚠️ Warning: Transcriber failed to load: {e}")

def transcribe_audio(audio_bytes: bytes) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = transcriber(tmp_path)
        return result["text"].strip()
    except Exception:
        return ""
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)