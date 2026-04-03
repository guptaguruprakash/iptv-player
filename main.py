from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field


app = FastAPI(title="IPTV Player API", version="1.0.0")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


class PlaylistLoadRequest(BaseModel):
    url: str = Field(min_length=5)


def parse_m3u_playlist(content: str) -> list[dict[str, Any]]:
    channels: list[dict[str, Any]] = []
    lines = [line.strip() for line in content.splitlines()]

    current: dict[str, Any] | None = None

    for line in lines:
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

        if line.startswith("#"):
            continue

        if current is None:
            continue

        current["stream_url"] = line
        channels.append(current)
        current = None

    return channels


@app.get("/")
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


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
        raise HTTPException(
            status_code=422,
            detail="No channels found. Make sure this is a valid M3U playlist.",
        )

    # Keep API responses reasonably sized for very large lists.
    max_channels = 1000
    trimmed = channels[:max_channels]

    return {
        "count": len(trimmed),
        "channels": trimmed,
        "truncated": len(channels) > max_channels,
    }