from __future__ import annotations

from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="IPTV Player API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PlaylistLoadRequest(BaseModel):
    url: str = Field(min_length=5)


def parse_m3u_playlist(content: str) -> list[dict[str, Any]]:
    channels: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if line.startswith("#EXTINF"):
            name = line.split(",", 1)[-1].strip() if "," in line else "Unknown Channel"
            group = "Other"
            logo = ""

            if 'group-title="' in line:
                group = line.split('group-title="', 1)[1].split('"', 1)[0].strip() or "Other"
            if 'tvg-logo="' in line:
                logo = line.split('tvg-logo="', 1)[1].split('"', 1)[0].strip()

            current = {
                "name": name,
                "category": group,
                "logo": logo,
                "stream_url": "",
                "quality": "HD",
                "live": True,
            }
            continue

        if line.startswith("#") or current is None:
            continue

        current["stream_url"] = line
        channels.append(current)
        current = None

    return channels


@app.get("/")
def root() -> dict[str, str]:
    return {
        "status": "ok",
        "message": "IPTV Player API is running",
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/playlist/load")
async def load_playlist(payload: PlaylistLoadRequest) -> dict[str, Any]:
    if not payload.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Playlist URL must start with http:// or https://")

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(payload.url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to fetch playlist: {exc}") from exc

    channels = parse_m3u_playlist(response.text)
    if not channels:
        raise HTTPException(status_code=422, detail="No channels found. Make sure this is a valid M3U playlist.")

    max_channels = 1000
    trimmed = channels[:max_channels]
    return {
        "count": len(trimmed),
        "channels": trimmed,
        "truncated": len(channels) > max_channels,
    }
