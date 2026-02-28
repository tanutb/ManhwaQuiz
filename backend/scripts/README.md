# Quiz pool update scripts

## update_pool.py

Refreshes or extends the manhwa quiz pool (used by the API and game).

Run from the **backend** directory:

```bash
# From repo root
cd backend

# Full refresh from MangaDex (overwrites pool)
python -m scripts.update_pool --source mangadex --limit 500

# Merge new titles with existing pool (dedupe by id)
python -m scripts.update_pool --source mangadex --merge --limit 200

# Use all sources (MangaDex + scraper)
python -m scripts.update_pool --source all --limit 300

# Custom output path
python -m scripts.update_pool --source mangadex --limit 100 --output data/my_pool.json

# Default advanced-search behavior is:
# - order by most followers
# - original language Korean
# Override language when needed
python -m scripts.update_pool --source mangadex --language ko --limit 200
```

Options:

- `--source`: `mangadex` | `scraper` | `all` (default: `all`)
- `--limit`: max items to fetch per source (default: 300)
- `--language`: original language filter (default: `ko`)
- `--output`: output JSON path (default: `data/manhwa_pool.json`)
- `--merge`: merge with existing file and dedupe by `id`

MangaDex is the preferred source (official API, compliant use). The scraper is an optional extra source.

## scrape_manhwa.py

Used by `update_pool --source scraper` or `--source all`. Can be run alone for testing:

```bash
python -m scripts.scrape_manhwa
```

Respect the target site’s ToS and rate limits.
