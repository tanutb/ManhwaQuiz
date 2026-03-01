import asyncio
import re
import time
from pathlib import Path

import httpx
from pydantic import BaseModel, Field
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import APIKeyHeader
from starlette import status

from config import settings
from services.pool import load_pool, suggest_titles, get_available_genres
from services.room_manager import rooms

api_key_header = APIKeyHeader(name="X-API-Key")

async def get_api_key(api_key: str = Depends(api_key_header)):
    if api_key != settings.api_secret_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
        )
    return api_key

app = FastAPI(title="Manhwa Quiz API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

POOL_PATH = Path(__file__).parent / settings.pool_path

@app.on_event("startup")
async def startup_event():
    # Pre-load the pool on server startup to populate genres list etc.
    load_pool(str(POOL_PATH))

class CreateRoomRequest(BaseModel):
    room_code: str | None = None
    rounds_total: int = Field(default=settings.rounds_per_game, ge=3, le=30)
    seconds_per_round: int = Field(default=settings.seconds_per_round, ge=10, le=90)
    max_players: int = Field(default=settings.max_players_per_room, ge=2, le=20)
    suggestions_enabled: bool = settings.suggestions_enabled_default
    difficulty: str = Field(default="medium", pattern=r"^(easy|medium|hard)$")
    genres: list[str] | None = None


def _normalize_custom_code(raw: str | None) -> str | None:
    if not raw:
        return None
    code = raw.strip().upper()
    if not code:
        return None
    if not re.fullmatch(r"[A-Z0-9]{4,8}", code):
        return None
    return code


@app.get("/api/health", dependencies=[])
def health():
    return {"status": "ok"}


@app.post("/api/rooms", dependencies=[Depends(get_api_key)])
def create_room(payload: CreateRoomRequest | None = None):
    body = payload or CreateRoomRequest()
    custom_code = _normalize_custom_code(body.room_code)
    if body.room_code and not custom_code:
        return {"error": "invalid_room_code", "message": "Room code must be 4-8 uppercase letters/numbers."}

    code, owner_id = rooms.create_room(
        room_code=custom_code,
        rounds_total=body.rounds_total,
        seconds_per_round=body.seconds_per_round,
        max_players=body.max_players,
        suggestions_enabled=body.suggestions_enabled,
        difficulty=body.difficulty,
        genres=body.genres,
    )
    if not code or not owner_id:
        return {"error": "room_code_taken", "message": "Room code is already in use."}
    return {"room_code": code, "owner_id": owner_id}


@app.get("/api/rooms/{room_code}", dependencies=[Depends(get_api_key)])
def get_room(room_code: str):
    if not rooms.room_exists(room_code):
        return {"exists": False}
    return {"exists": True}


@app.get("/api/genres", dependencies=[Depends(get_api_key)])
def get_genres():
    return {"genres": get_available_genres()}


@app.get("/api/suggest", dependencies=[Depends(get_api_key)])
def suggest(
    q: str = Query("", min_length=0),
    limit: int = Query(10, ge=1, le=20),
):
    return {"suggestions": suggest_titles(q, limit)}


@app.get("/api/covers/{manga_id}/{filename:path}")
async def proxy_cover(manga_id: str, filename: str):
    url = f"https://uploads.mangadex.org/covers/{manga_id}/{filename}"
    async with httpx.AsyncClient() as client:
        r = await client.get(url)
        r.raise_for_status()
        return StreamingResponse(
            r.iter_bytes(),
            media_type=r.headers.get("content-type", "image/jpeg"),
            headers={"Cache-Control": "public, max-age=86400"},
        )


_room_timer_tasks: dict[str, asyncio.Task] = {}


async def _broadcast_room_state(room_code: str):
    code = (room_code or "").upper()
    state = rooms.state_for_room(code)
    if state.get("error"):
        return
    for conn in list(rooms.get_connections(code)):
        try:
            await conn.send_json({"event": "room_state", "state": state})
        except Exception:
            rooms.leave_connection(conn)


async def _run_round_timer(room_code: str):
    code = (room_code or "").upper()
    try:
        while True:
            room = rooms.get_room(code)
            if not room or room.phase != "playing" or room.round_ends_at <= 0:
                return

            while True:
                room = rooms.get_room(code)
                if not room or room.phase != "playing":
                    return
                remaining = max(0, int(room.round_ends_at - time.time()))
                for conn in list(rooms.get_connections(code)):
                    try:
                        await conn.send_json({"event": "tick", "seconds_left": remaining})
                    except Exception:
                        rooms.leave_connection(conn)
                if rooms.all_players_answered(code):
                    break
                if remaining <= 0:
                    break
                await asyncio.sleep(1)

            result = rooms.end_round_and_advance(code)
            if not result:
                return

            for conn in list(rooms.get_connections(code)):
                try:
                    await conn.send_json({"event": result["event"], **result})
                except Exception:
                    rooms.leave_connection(conn)

            if result.get("event") == "game_over":
                return

            await asyncio.sleep(4)
            rooms.start_round(code)
            room = rooms.get_room(code)
            if not room:
                return
            state = rooms.state_for_room(code)
            state["round_ends_at"] = room.round_ends_at
            for conn in list(rooms.get_connections(code)):
                try:
                    await conn.send_json({"event": "round_start", "state": state})
                except Exception:
                    rooms.leave_connection(conn)
    finally:
        _room_timer_tasks.pop(code, None)


@app.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    room_code: str = Query(...),
    player_name: str = Query("Player"),
    owner_id: str = Query(None),
    player_id: str = Query(None),
):
    await ws.accept()
    code = (room_code or "").upper()
    if not rooms.room_exists(code):
        await ws.send_json({"event": "error", "message": "room_not_found"})
        await ws.close()
        return
    room, joined_player_id = rooms.join_room(code, player_name, ws, player_id)
    if not room or not joined_player_id:
        await ws.send_json({"event": "error", "message": "join_failed"})
        await ws.close()
        return
    await ws.send_json({
        "event": "joined",
        "player_id": joined_player_id,
        "owner_id": room.owner_id,
        "state": rooms.state_for_room(code),
    })
    await _broadcast_room_state(code)

    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type") or data.get("event")
            if msg_type == "start_game":
                r = rooms.get_room(code)
                is_owner = r and (r.owner_id == owner_id)
                if not is_owner:
                    continue
                if rooms.start_game(code, str(POOL_PATH)):
                    rooms.start_round(code)
                    r = rooms.get_room(code)
                    state = rooms.state_for_room(code)
                    state["round_ends_at"] = r.round_ends_at
                    for conn in list(rooms.get_connections(code)):
                        try:
                            await conn.send_json({"event": "round_start", "state": state})
                        except Exception:
                            rooms.leave_connection(conn)
                    if code not in _room_timer_tasks:
                        _room_timer_tasks[code] = asyncio.create_task(_run_round_timer(code))
            elif msg_type == "submit_answer":
                answer = data.get("answer", "")
                rooms.submit_answer(code, joined_player_id, answer)
                await ws.send_json({"event": "answer_received"})
                await _broadcast_room_state(code)
    except Exception:
        pass
    finally:
        rooms.leave_connection(ws)
        await _broadcast_room_state(code)
        
        if joined_player_id:
            async def delayed_cleanup():
                await asyncio.sleep(3)
                rooms.remove_player_if_inactive(code, joined_player_id)
                await _broadcast_room_state(code)
            asyncio.create_task(delayed_cleanup())
