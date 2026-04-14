from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.voice_service import VoiceSession

router = APIRouter()


@router.get("/api/v1/audio/health")
async def health():
    return {"ok": True, "service": "audio-stream"}


@router.websocket("/ws/audio")
async def ws_audio(websocket: WebSocket):
    await websocket.accept()

    user_id = websocket.query_params.get("userId")
    task_context = websocket.query_params.get("taskContext")
    session = VoiceSession(user_id=user_id, task_context=task_context)

    await websocket.send_json(
        {
            "type": "emotion_update",
            "emotion": "calm",
            "pitch_score": 0.0,
            "cadence_score": 0.0,
        }
    )

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            raw_chunk = message.get("bytes")
            if raw_chunk is not None:
                for outbound in session.process_chunk(raw_chunk):
                    await websocket.send_json(outbound)
                continue

            text_message = message.get("text")
            if text_message and text_message.strip().lower() == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        session.flush_pending_event()
    except Exception:
        session.flush_pending_event()
        raise
