# backend-python/app/api/sockets.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json
import logging
import os
import urllib.error
import urllib.request

import numpy as np

from app.core.emotion_ai import analyze_audio
from app.core.transcriber import transcribe_audio
from app.core.generator import generate_insight

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

SAMPLE_RATE = 16000
PROCESS_WINDOW_SECONDS = float(os.getenv("AUDIO_PROCESS_WINDOW_SECONDS", "2.5"))
PROCESS_WINDOW_SAMPLES = max(8000, int(SAMPLE_RATE * PROCESS_WINDOW_SECONDS))
MAX_BUFFER_SECONDS = float(os.getenv("AUDIO_MAX_BUFFER_SECONDS", "8"))
MAX_BUFFER_SAMPLES = int(SAMPLE_RATE * MAX_BUFFER_SECONDS)
NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:5001").rstrip("/")


def map_emotion_label(raw_label: str) -> str:
    label = (raw_label or "").strip().lower()
    if label == "high_arousal":
        return "high_anxiety"
    if label in {"sad", "unknown"}:
        return "mild_anxiety"
    return "calm"


def _post_vocal_stress_event_sync(user_id: str, emotion: str, arousal_score: float) -> None:
    if not user_id:
        return

    payload = json.dumps(
        {
            "userId": user_id,
            "emotion": emotion,
            "arousalScore": max(1.0, min(10.0, float(arousal_score))),
            "taskContext": "aura_voice_live_stream",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{NODE_BACKEND_URL}/api/clinical/vocal-stress",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=2.5) as response:
            if response.status >= 400:
                logger.warning("clinical log failed with status %s", response.status)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
        logger.warning("clinical log request failed: %s", exc)


async def post_vocal_stress_event(user_id: str, emotion: str, arousal_score: float) -> None:
    await asyncio.to_thread(_post_vocal_stress_event_sync, user_id, emotion, arousal_score)


@router.websocket("/ws/audio")
async def audio_endpoint(websocket: WebSocket):
    await websocket.accept()
    user_id = websocket.query_params.get("userId", "").strip()
    logger.info("🟢 Client connected to Aura Voice Engine. userId=%s", user_id or "anonymous")

    try:
        audio_buffer = np.array([], dtype=np.float32)
        while True:
            audio_bytes = await websocket.receive_bytes()
            chunk = np.frombuffer(audio_bytes, dtype=np.float32)

            if chunk.size == 0:
                continue

            audio_buffer = np.concatenate((audio_buffer, chunk))
            if audio_buffer.size > MAX_BUFFER_SAMPLES:
                audio_buffer = audio_buffer[-MAX_BUFFER_SAMPLES:]

            if audio_buffer.size < PROCESS_WINDOW_SAMPLES:
                continue

            window = np.array(audio_buffer[:PROCESS_WINDOW_SAMPLES], dtype=np.float32)
            audio_buffer = audio_buffer[PROCESS_WINDOW_SAMPLES:]

            analysis = analyze_audio(window, sample_rate=SAMPLE_RATE)
            emotion = map_emotion_label(analysis.get("primary"))
            arousal_score = float(analysis.get("arousal_score", 5.0))

            emotion_payload = {
                "type": "emotion_update",
                "emotion": emotion,
                "arousal_score": arousal_score,
                "confidence": float(analysis.get("confidence", 0.0)),
            }
            await websocket.send_text(json.dumps(emotion_payload))

            text = transcribe_audio(window, sample_rate=SAMPLE_RATE)
            if text:
                await websocket.send_text(json.dumps({"type": "transcript", "text": text}))

                insight = generate_insight(text, emotion)
                response_text = insight or "I am with you. Let's move one small step at a time."
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "response",
                            "text": response_text,
                            "emotion": emotion,
                            "tts_audio": None,
                        }
                    )
                )

            await post_vocal_stress_event(user_id, emotion, arousal_score)
            
    except WebSocketDisconnect:
        logger.info("🔴 Client disconnected.")
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
