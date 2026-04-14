from __future__ import annotations

import httpx

from app.core.config import settings


async def post_vocal_stress_event(
    *,
    user_id: str | None,
    emotion: str,
    arousal_score: float,
    task_context: str | None = None,
) -> None:
    if not user_id:
        return

    url = f"{settings.NODE_BACKEND_URL.rstrip('/')}/api/clinical/vocal-stress"
    payload = {
        "userId": user_id,
        "emotion": emotion,
        "arousalScore": arousal_score,
        "taskContext": task_context,
    }

    timeout = httpx.Timeout(connect=2.0, read=4.0, write=4.0, pool=4.0)
    
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload)
            if response.status_code >= 400:
                print(
                    f"[NodeBridge] sync failed ({response.status_code}): {response.text[:100]}"
                )
    except httpx.ConnectError:
        print(f"[NodeBridge] connection refused at {url}. Is the Node backend running?")
    except httpx.ConnectTimeout:
        print(f"[NodeBridge] connection timeout at {url}. Network is slow or server is overloaded.")
    except Exception as exc:
        print(f"[NodeBridge] sync error: {exc!r}")
