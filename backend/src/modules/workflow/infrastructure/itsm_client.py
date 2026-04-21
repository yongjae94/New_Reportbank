from __future__ import annotations

from typing import Any

import httpx

from core.config import get_settings


class ItsmCallbackClient:
    async def notify_completion(self, payload: dict[str, Any]) -> None:
        settings = get_settings()
        if not settings.itsm_callback_url:
            return
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if settings.itsm_callback_token:
            headers["Authorization"] = f"Bearer {settings.itsm_callback_token}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(settings.itsm_callback_url, json=payload, headers=headers)
