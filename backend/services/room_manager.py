import secrets
import time
import random
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from config import settings
from services.pool import load_pool, pick_questions, score_answer


def gen_room_code() -> str:
    return secrets.token_hex(3).upper()[:6]


@dataclass
class Player:
    id: str
    name: str
    score: int = 0


@dataclass
class RoomState:
    room_code: str
    owner_id: str
    players: dict[str, Player] = field(default_factory=dict)
    phase: str = "lobby"
    round_index: int = 0
    rounds_total: int = 10
    questions: list[dict] = field(default_factory=list)
    current_question: dict | None = None
    round_ends_at: float = 0
    answers: dict[str, str] = field(default_factory=dict)
    results: list[dict] = field(default_factory=list)
    seconds_per_round: int = 20
    points_exact: int = 100
    points_fuzzy: int = 50
    max_players: int = 8
    suggestions_enabled: bool = True
    difficulty: str = "medium"
    genres: list[str] | None = None
    sort_by: str = "views"
    pool_size: int | None = None


class RoomManager:
    def __init__(self):
        self._rooms: dict[str, RoomState] = {}
        self._connections: dict[str, set[Any]] = defaultdict(set)
        self._player_room: dict[int, str] = {}  # ws_id -> room_code
        self._ws_to_player: dict[int, tuple[str, str]] = {}  # ws_id -> (room_code, player_id)
        self._player_to_ws: dict[str, int] = {}  # player_id -> ws_id
        self._wid_to_ws: dict[int, Any] = {}  # ws_id -> ws (for reattach cleanup)

    def create_room(
        self,
        room_code: str | None = None,
        rounds_total: int | None = None,
        seconds_per_round: int | None = None,
        max_players: int | None = None,
        suggestions_enabled: bool | None = None,
        difficulty: str | None = None,
        genres: list[str] | None = None,
        sort_by: str | None = None,
        pool_size: int | None = None,
    ) -> tuple[str | None, str | None]:
        code = (room_code or "").strip().upper()
        if code:
            if code in self._rooms:
                return None, None
        else:
            code = gen_room_code()
            while code in self._rooms:
                code = gen_room_code()
        owner_id = secrets.token_hex(8)
        self._rooms[code] = RoomState(
            room_code=code,
            owner_id=owner_id,
            rounds_total=rounds_total or settings.rounds_per_game,
            seconds_per_round=seconds_per_round or settings.seconds_per_round,
            max_players=max_players or settings.max_players_per_room,
            suggestions_enabled=(
                settings.suggestions_enabled_default
                if suggestions_enabled is None
                else suggestions_enabled
            ),
            difficulty=difficulty or "medium",
            genres=genres,
            sort_by=sort_by or "views",
            pool_size=pool_size,
        )
        return code, owner_id

    def room_exists(self, room_code: str) -> bool:
        return (room_code or "").upper() in self._rooms

    def get_room(self, room_code: str) -> RoomState | None:
        return self._rooms.get((room_code or "").upper())

    def join_room(self, room_code: str, player_name: str, ws: Any, player_id: str | None = None) -> tuple[RoomState | None, str | None]:
        code = (room_code or "").upper()
        room = self._rooms.get(code)
        if not room:
            return None, None
        
        wid = id(ws)

        if player_id and player_id in room.players:
            old_wid = self._player_to_ws.get(player_id)
            if old_wid and old_wid != wid:
                self._player_room.pop(old_wid, None)
                self._ws_to_player.pop(old_wid, None)
                old_ws = self._wid_to_ws.pop(old_wid, None)
                if old_ws is not None:
                    self._connections[code].discard(old_ws)

            self._connections[code].add(ws)
            self._wid_to_ws[wid] = ws
            self._player_room[wid] = code
            self._ws_to_player[wid] = (code, player_id)
            self._player_to_ws[player_id] = wid
            return room, player_id

        if len(room.players) >= room.max_players:
            return None, None
            
        pid = player_id if player_id and len(player_id) >= 8 else secrets.token_hex(8)
        if pid in room.players:
            pid = secrets.token_hex(8)
            while pid in room.players:
                pid = secrets.token_hex(8)

        room.players[pid] = Player(id=pid, name=(player_name or "Player").strip() or "Player")
        self._connections[code].add(ws)
        self._wid_to_ws[wid] = ws
        self._player_room[wid] = code
        self._ws_to_player[wid] = (code, pid)
        self._player_to_ws[pid] = wid
        return room, pid

    def leave_connection(self, ws: Any) -> None:
        wid = id(ws)
        self._wid_to_ws.pop(wid, None)
        code = self._player_room.pop(wid, None)
        player_ref = self._ws_to_player.pop(wid, None)
        
        if code:
            self._connections[code].discard(ws)

        if not player_ref:
            return

        _, player_id = player_ref
        
        if self._player_to_ws.get(player_id) == wid:
            self._player_to_ws.pop(player_id, None)
            
    def is_player_active(self, player_id: str) -> bool:
        return player_id in self._player_to_ws

    def remove_player_if_inactive(self, room_code: str, player_id: str):
        if not self.is_player_active(player_id):
            code = (room_code or "").upper()
            room = self._rooms.get(code)
            if room:
                room.players.pop(player_id, None)
                if not room.players:
                    self._rooms.pop(code, None)

    def get_connections(self, room_code: str) -> set:
        return self._connections.get((room_code or "").upper(), set())

    def get_player_for_ws(self, ws: Any) -> tuple[str, str] | None:
        return self._ws_to_player.get(id(ws))

    def start_game(self, room_code: str, pool_path: str) -> bool:
        code = (room_code or "").upper()
        room = self._rooms.get(code)
        if not room or room.phase != "lobby":
            return False
        
        pool = load_pool(pool_path)
        
        # Sort the pool based on the room's sort_by setting
        if room.sort_by == "rating":
            pool.sort(key=lambda x: x.get("rating", 0), reverse=True)
        else: # Default to views
            pool.sort(key=lambda x: x.get("views", 0), reverse=True)

        if room.genres:
            selected_genres = set(room.genres)
            pool = [item for item in pool if selected_genres.intersection(item.get("genres", []))]

        if room.difficulty == "easy":
            pool = pool[:50]
        elif room.difficulty == "medium":
            pool = pool[:200]
        elif room.difficulty == "custom" and room.pool_size:
            pool = pool[:room.pool_size]
        
        if not pool:
            pool = load_pool(pool_path)[:20]

        if len(pool) < room.rounds_total:
            room.rounds_total = len(pool)
        
        if room.rounds_total == 0:
             return False

        room.questions = pick_questions(pool, room.rounds_total)
        room.phase = "playing"
        room.round_index = 0
        room.results = []
        return True

    def get_current_question(self, room_code: str) -> dict | None:
        room = self.get_room(room_code)
        if not room or not room.questions or room.round_index >= len(room.questions):
            return None
        q = room.questions[room.round_index]
        return {"manga_id": q["id"], "title": q["title"], "cover_filename": q.get("cover_filename", "")}

    def start_round(self, room_code: str) -> dict | None:
        room = self.get_room(room_code)
        if not room or room.phase != "playing":
            return None
        room.current_question = self.get_current_question(room_code)
        room.answers = {}
        room.round_ends_at = time.time() + room.seconds_per_round
        return room.current_question

    def submit_answer(self, room_code: str, player_id: str, answer: str) -> None:
        room = self.get_room((room_code or "").upper())
        if room and room.phase == "playing":
            room.answers[player_id] = (answer or "").strip()

    def all_players_answered(self, room_code: str) -> bool:
        room = self.get_room((room_code or "").upper())
        if not room or room.phase != "playing": return False
        
        active_pids = [pid for pid in room.players.keys() if self.is_player_active(pid)]
        if not active_pids:
            return False
            
        for pid in active_pids:
            if not (room.answers.get(pid) or "").strip():
                return False
        return True

    def end_round_and_advance(self, room_code: str) -> dict | None:
        code = (room_code or "").upper()
        room = self._rooms.get(code)
        if not room or room.phase != "playing" or not room.current_question:
            return None
        correct = room.current_question.get("title", "")
        for pid, p in room.players.items():
            pts = score_answer(room.answers.get(pid, ""), correct, room.points_exact, room.points_fuzzy)
            p.score += pts
        result = {
            "correct_title": correct,
            "scores": [{"player_id": pid, "name": p.name, "score": p.score} for pid, p in room.players.items()],
            "answers": room.answers,
        }
        room.results.append(result)
        room.round_index += 1
        if room.round_index >= len(room.questions):
            room.phase = "results"
            room.current_question = None
            return {"event": "game_over", "results": room.results, "scores": result["scores"]}
        room.current_question = None
        return {"event": "round_end", "result": result}

    def state_for_room(self, room_code: str, round_ends_at_override: float | None = None) -> dict:        
        code = (room_code or "").upper()
        room = self._rooms.get(code)
        if not room:
            return {"error": "room_not_found"}
        ends_at = round_ends_at_override if round_ends_at_override is not None else room.round_ends_at    
        return {
            "room_code": room.room_code,
            "owner_id": room.owner_id,
            "players": [{"id": p.id, "name": p.name, "score": p.score} for p in room.players.values()],   
            "phase": room.phase,
            "round_index": room.round_index,
            "rounds_total": room.rounds_total,
            "seconds_per_round": room.seconds_per_round,
            "max_players": room.max_players,
            "suggestions_enabled": room.suggestions_enabled,
            "difficulty": room.difficulty,
            "genres": room.genres,
            "sort_by": room.sort_by,
            "pool_size": room.pool_size,
            "current_question": room.current_question,
            "answered_players": list(room.answers.keys()) if room.phase == "playing" else [],
            "round_ends_at": ends_at,
            "results": room.results[-1:] if room.results else [],
        }

rooms = RoomManager()
