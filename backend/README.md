# Manhwa Quiz - Backend API

This directory contains the Python FastAPI backend for the Manhwa Quiz application. It serves as the authoritative state machine for all multiplayer game rooms and manages the WebSocket connections that drive the real-time gameplay.

## Core Responsibilities

1.  **WebSocket State Management:** The `RoomManager` (`services/room_manager.py`) holds the active state for every game room in memory, handling user joins, disconnects, answers, and timer ticks.
2.  **Game Logic:** It validates custom room settings, pulls from the static JSON data pool to generate randomized, genre-filtered quizzes, and scores answers based on an exact or fuzzy string match.
3.  **Data Caching & Search:** On startup, it loads the `manhwa_pool.json` database into memory and creates an optimized `TitleIndex` (`services/pool.py`) to provide extremely fast auto-complete suggestions to the frontend via a REST endpoint.
4.  **Cover Proxying:** It acts as a proxy for downloading cover images from MangaDex (`main.py`) to bypass browser CORS restrictions and cache images efficiently.

## Local Development Setup

1. **Prerequisites:** Ensure you have Python 3.10+ installed.
2. **Virtual Environment:** 
   ```bash
   python -m venv venv
   # Windows:
   source venv/Scripts/activate
   # Mac/Linux:
   source venv/bin/activate
   ```
3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Run the Server:**
   ```bash
   python main.py
   ```
   The server runs on `http://127.0.0.1:8000` by default.

## Scripts & Data Management

The backend relies on a static JSON file (`data/manhwa_pool.json`) for its quiz questions.

To update this pool with fresh data and genres from the MangaDex API:
```bash
python -m scripts.update_pool --source scraper --limit 200 --language ko
```
