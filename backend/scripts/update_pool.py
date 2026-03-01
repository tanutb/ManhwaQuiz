import argparse
import asyncio
import sys
from pathlib import Path

# Fix module import paths for script execution.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.pool import load_pool, save_pool
from services.mangadex import fetch_manga_pool


def main():
    parser = argparse.ArgumentParser(description="Update manhwa quiz pool")
    parser.add_argument("--source", choices=["mangadex", "scraper", "all"], default="all")
    parser.add_argument("--limit", type=int, default=300)
    parser.add_argument("--output", type=str, default=None)
    parser.add_argument("--language", type=str, default="ko", help="Original language filter (default: ko)")
    parser.add_argument("--merge", action="store_true", help="Merge with existing pool and dedupe by id")
    args = parser.parse_args()
    base = Path(__file__).resolve().parent.parent
    output_path = Path(args.output or base / "data" / "manhwa_pool.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    existing = load_pool(str(output_path)) if output_path.exists() else []
    seen = {item["id"] for item in existing} if args.merge else set()
    items = list(existing) if args.merge else []

    if args.source in ("mangadex", "all"):
        async def add_mangadex():
            fetched = await fetch_manga_pool(limit=args.limit, original_language=args.language)
            for item in fetched:
                if item["id"] not in seen:
                    seen.add(item["id"])
                    items.append(item)
        asyncio.run(add_mangadex())

    if args.source in ("scraper", "all"):
        try:
            from scripts.scrape_manhwa import scrape_manhwa_list
            scraped = scrape_manhwa_list(limit=args.limit, original_language=args.language)
            for item in scraped:
                if item.get("id") and item["id"] not in seen:
                    seen.add(item["id"])
                    items.append(item)
        except ImportError:
            pass

    # Keep output ordered by views descending for validation/top-N checks.
    items.sort(
        key=lambda x: (
            -int(x.get("views") or 0),
            (x.get("title") or "").lower(),
        )
    )
    meta = {
        "validation_query": {
            "order[followedCount]": "desc",
            "originalLanguage[]": args.language,
            "contentRating[]": "safe",
        },
        "source": args.source,
    }
    save_pool(str(output_path), items, meta=meta)
    print(f"Wrote {len(items)} items to {output_path}")


if __name__ == "__main__":
    main()
