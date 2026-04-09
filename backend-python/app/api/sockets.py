# backend-python/app/api/sockets.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import logging

from app.core.emotion_ai import analyze_audio
from app.core.transcriber import transcribe_audio
from app.core.generator import generate_insight

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/ws/audio")
async def audio_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("🟢 Client connected to Aura Voice Engine.")

    try:
        while True:
            audio_bytes = await websocket.receive_bytes()
            
            # 1. Emotion Score
            analysis = analyze_audio(audio_bytes)
            
            # 2. Transcribe Speech
            text = transcribe_audio(audio_bytes)
            
            # 3. Generate Insight
            insight = generate_insight(text, analysis["primary"])

            # 4. Construct Payload
            response_payload = {
                "status": "success",
                "emotions": {
                    "primary": analysis["primary"],
                    "arousal_score": analysis["arousal_score"],
                    "confidence": analysis["confidence"]
                },
                "speech": {
                    "text": text,
                    "ai_insight": insight
                },
                "trigger_interruption": analysis["arousal_score"] > 8.0 
            }
            
            await websocket.send_text(json.dumps(response_payload))
            
    except WebSocketDisconnect:
        logger.info("🔴 Client disconnected.")
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")