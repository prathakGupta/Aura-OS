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

    timeout = httpx.Timeout(connect=1.0, read=2.0, write=2.0, pool=2.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload)
            if response.status_code >= 400:
                print(
                    f"[NodeBridge] vocal-stress sync failed with status "
                    f"{response.status_code}: {response.text[:200]}"
                )
    except Exception as exc:
        print(f"[NodeBridge] vocal-stress sync error: {exc!r}")
