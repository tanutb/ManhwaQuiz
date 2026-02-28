import httpx

MANGADEX_BASE = "https://api.mangadex.org"
COVERS_BASE = "https://uploads.mangadex.org/covers"


async def _fetch_follow_counts(client: httpx.AsyncClient, manga_ids: list[str]) -> dict[str, int]:
    if not manga_ids:
        return {}
    resp = await client.get(
        f"{MANGADEX_BASE}/statistics/manga",
        params={"manga[]": manga_ids},
    )
    resp.raise_for_status()
    data = resp.json()
    stats = data.get("statistics", {}) if isinstance(data, dict) else {}
    return {mid: int((stats.get(mid) or {}).get("follows") or 0) for mid in manga_ids}


async def fetch_manga_pool(
    limit: int = 300,
    content_rating: str = "safe",
    original_language: str = "ko",
) -> list[dict]:
    """Fetch manga list from MangaDex with cover art and follower count."""
    results = []
    offset = 0
    async with httpx.AsyncClient(timeout=30.0) as client:
        while len(results) < limit:
            resp = await client.get(
                f"{MANGADEX_BASE}/manga",
                params={
                    "limit": min(100, limit - len(results)),
                    "offset": offset,
                    "contentRating[]": content_rating,
                    "originalLanguage[]": original_language,
                    "includes[]": ["cover_art", "tag"],
                    "order[followedCount]": "desc",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            page_items = data.get("data", [])
            page_ids = [entry.get("id") for entry in page_items if entry.get("id")]
            follow_counts = await _fetch_follow_counts(client, page_ids)
            for item in page_items:
                attrs = item.get("attributes", {})
                title_obj = attrs.get("title") or {}
                # raw name = first value from the main title object (usually ko-ro, ko, etc.)
                raw_name = list(title_obj.values())[0] if title_obj else ""

                # English name: prefer title.en, then first en entry in altTitles
                alt_titles = attrs.get("altTitles") or []
                en_from_alt = next(
                    (a["en"] for a in alt_titles if isinstance(a, dict) and "en" in a),
                    None,
                )
                title = title_obj.get("en") or en_from_alt or raw_name
                followed_count = follow_counts.get(item.get("id", ""), 0)
                if not title:
                    continue

                tags = attrs.get("tags", [])
                genres = sorted([
                    t.get("attributes", {}).get("name", {}).get("en")
                    for t in tags
                    if t.get("type") == "tag"
                    and t.get("attributes", {}).get("group") == "genre"
                    and t.get("attributes", {}).get("name", {}).get("en")
                ])

                rels = {r["type"]: r for r in item.get("relationships", [])}
                cover = rels.get("cover_art")
                if not cover:
                    continue
                cover_attrs = cover.get("attributes", {})
                filename = cover_attrs.get("fileName") or ""
                if not filename:
                    continue
                results.append({
                    "id": item["id"],
                    "title": title,
                    "RAW_NAME": raw_name,
                    "cover_filename": filename,
                    "followedCount": followed_count,
                    "genres": genres,
                })
                if len(results) >= limit:
                    break
            total = data.get("total", 0)
            if offset + len(data.get("data", [])) >= total:
                break
            offset += len(data.get("data", []))
    return results


def build_cover_url(manga_id: str, cover_filename: str, size: int | None = 256) -> str:
    if size:
        suffix = f".{size}.jpg"
        if not cover_filename.endswith(suffix):
            filename = f"{cover_filename}{suffix}"
        else:
            filename = cover_filename
    else:
        filename = cover_filename
    return f"{COVERS_BASE}/{manga_id}/{filename}"
