"""
Scraper for manhwa/manga listing sites. Output matches pool shape: id, title, cover_filename.
Default source query follows MangaDex advanced search intent:
- Sort by most followers
- Original language is Korean
"""

import httpx


def _fetch_statistics(client: httpx.Client, manga_ids: list[str]) -> dict[str, dict]:
    if not manga_ids:
        return {}
    r = client.get(
        "https://api.mangadex.org/statistics/manga",
        params={"manga[]": manga_ids},
    )
    r.raise_for_status()
    data = r.json()
    stats = data.get("statistics", {}) if isinstance(data, dict) else {}
    result = {}
    for mid in manga_ids:
        manga_stats = stats.get(mid) or {}
        rating = manga_stats.get("rating") or {}
        result[mid] = {
            "views": int(manga_stats.get("follows") or 0),
            "rating": float(rating.get("bayesian") or 0.0),
        }
    return result


def scrape_manhwa_list(limit: int = 100, original_language: str = "ko") -> list[dict]:
    """
    Scrape a listing page and return list of {id, title, cover_filename} or {id, title, cover_url}.
    Using MangaDex public listing as fallback (HTML) when API is not used.
    """
    items = []
    offset = 0
    try:
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            while len(items) < limit:
                r = client.get("https://api.mangadex.org/manga", params={
                    "limit": min(100, limit - len(items)),
                    "offset": offset,
                    "contentRating[]": "safe",
                    "originalLanguage[]": original_language,
                    "order[followedCount]": "desc",
                    "includes[]": ["cover_art"],
                })
                r.raise_for_status()
                data = r.json()
                rows = data.get("data", [])
                if not rows:
                    break
                row_ids = [entry.get("id") for entry in rows if entry.get("id")]
                statistics = _fetch_statistics(client, row_ids)
                for item in rows:
                    attrs = item.get("attributes", {})
                    title_obj = attrs.get("title") or {}
                    raw_name = list(title_obj.values())[0] if title_obj else ""

                    alt_titles = attrs.get("altTitles") or []
                    en_from_alt = next(
                        (a["en"] for a in alt_titles if isinstance(a, dict) and "en" in a),
                        None,
                    )
                    title = title_obj.get("en") or en_from_alt or raw_name
                    stats = statistics.get(item.get("id", ""), {})
                    views = stats.get("views", 0)
                    rating = stats.get("rating", 0.0)
                    if not title:
                        continue

                    tags = attrs.get("tags", [])
                    genres = sorted([
                        t.get("attributes", {}).get("name", {}).get("en")
                        for t in tags
                        if t.get("type") == "tag" and t.get("attributes", {}).get("group") == "genre"
                        and t.get("attributes", {}).get("name", {}).get("en")
                    ])

                    rels = {x["type"]: x for x in item.get("relationships", [])}
                    cover = rels.get("cover_art", {}).get("attributes", {})
                    filename = cover.get("fileName") or ""
                    if filename:
                        items.append({
                            "id": item["id"],
                            "title": title,
                            "RAW_NAME": raw_name,
                            "cover_filename": filename,
                            "views": views,
                            "rating": rating,
                            "genres": genres,
                        })
                    if len(items) >= limit:
                        break
                total = data.get("total", 0)
                offset += len(rows)
                if offset >= total:
                    break
    except Exception as e:
        print(f"Scraper warning: {e}")
    return items


if __name__ == "__main__":
    out = scrape_manhwa_list(50)
    print(len(out), "items")
    if out:
        print(out[0])
