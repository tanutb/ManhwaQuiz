import json
import random
from pathlib import Path

# ── Search Index for fast auto-suggestions ────────────────────────────────

class TitleIndex:
    def __init__(self, pool: list[dict]):
        self._titles: list[str] = []
        seen = set()
        for item in pool:
            title = (item.get("title") or "").strip()
            if title and title not in seen:
                seen.add(title)
                self._titles.append(title)

    def search(self, prefix: str, limit: int = 10) -> list[str]:
        q = prefix.lower()
        results = []
        
        # Prioritize exact prefix matches first
        for title in self._titles:
            if title.lower().startswith(q):
                results.append(title)
                if len(results) >= limit:
                    return results
                    
        # Then fill with partial matches
        for title in self._titles:
            if title not in results and q in title.lower():
                results.append(title)
                if len(results) >= limit:
                    return results
                    
        return results

# ── Global state ────────────────────────────────────────────────────────────

_POOL: list[dict] = []
TITLE_INDEX: TitleIndex | None = None

# ── Core functions ──────────────────────────────────────────────────────────

def load_pool(pool_path: str) -> list[dict]:
    global _POOL, TITLE_INDEX
    if _POOL:
        return _POOL
    path = Path(pool_path)
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    _POOL = data if isinstance(data, list) else data.get("items", [])
    TITLE_INDEX = TitleIndex(_POOL)
    return _POOL


def save_pool(pool_path: str, items: list[dict], meta: dict | None = None) -> None:
    p = Path(pool_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    payload = {"meta": meta or {}, "items": items} if meta is not None else items
    p.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def pick_questions(pool: list[dict], count: int) -> list[dict]:
    if len(pool) < count:
        count = len(pool)
    return random.sample(pool, count)


def suggest_titles(q: str, limit: int = 10) -> list[str]:
    q = (q or "").strip()
    if not q or not TITLE_INDEX:
        return []
    return TITLE_INDEX.search(q, limit)


def normalize_title(s: str) -> str:
    return (s or "").strip().lower()


def score_answer(submitted: str, correct_title: str, points_exact: int, points_fuzzy: int) -> int:
    sub = normalize_title(submitted)
    correct = normalize_title(correct_title)
    if not sub:
        return 0
    if sub == correct:
        return points_exact
    # Keep fuzzy simple: substring match is good enough for a party game.
    if points_fuzzy > 0 and (correct in sub or sub in correct):
        return points_fuzzy
    return 0

def get_available_genres() -> list[str]:
    if not _POOL:
        return []
    all_genres = set()
    for item in _POOL:
        for g in item.get("genres", []):
            if g:
                all_genres.add(g)
    return sorted(list(all_genres))
