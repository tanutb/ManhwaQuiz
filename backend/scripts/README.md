# Quiz pool update scripts

## update_pool.py

Refreshes or extends the manhwa quiz pool (used by the API and game).

Run from the **backend** directory:

```bash
# From repo root
cd backend

# To get the full dataset with "rating" and "views" for custom sorting,
# you MUST use the 'scraper' source. This is the recommended method.
python -m scripts.update_pool --source scraper --limit 500

# To get a basic, faster list (without rating/views), use 'mangadex'.
# Note: This will NOT work for the custom "Sort by Rating" feature.
python -m scripts.update_pool --source mangadex --limit 500

# Merge new titles with existing pool (dedupe by id)
python -m scripts.update_pool --source scraper --merge --limit 200

# Custom output path
python -m scripts.update_pool --source scraper --limit 100 --output data/my_pool.json
```

Options:

- `--source`: `scraper` | `mangadex` | `all` (default: `all`)
  - **`scraper`**: **Required** for full data. Fetches detailed info including **rating** and **views** (followers). Slower.
  - **`mangadex`**: Basic, fast fetch. Does **not** include rating or views.
- `--limit`: max items to fetch per source (default: 300)
- `--language`: original language filter for MangaDex source (default: `ko`)
- `--output`: output JSON path (default: `data/manhwa_pool.json`)
- `--merge`: merge with existing file and dedupe by `id`

## scrape_manhwa.py

Used by `update_pool --source scraper` or `--source all`. Can be run alone for testing:

```bash
python -m scripts.scrape_manhwa
```

Respect the target site’s ToS and rate limits.
