# Manhwa Quiz

A real-time, multiplayer browser game where players guess the titles of popular Manhwa (Korean comics) based on their cover art.

## Features

*   **Real-time Multiplayer:** Powered by WebSockets, allowing up to 20 players to compete simultaneously.
*   **Highly Customizable Game Rooms:**
    *   Set the number of rounds and time per round.
    *   Choose from difficulty presets (Easy, Medium, Hard) or a custom **Top N** pool size.
    *   Sort the pool by **Most Popular** (views) or **Highest Rated**.
    *   Filter by specific genres with strict **"AND" logic** (manhwa must have all selected genres).
*   **Full-Screen Image Viewer:** Click on the cover image during a round to see a full-screen, high-resolution version.
*   **Smart Auto-Suggestions:** An intelligent, fast search algorithm helps players find titles, with an **auto-scrolling** list for easy keyboard navigation.
*   **Modern UI/UX:**
    *   Sleek "Deep Space" theme with glassmorphism effects and smooth animations.
    *   Responsive design for both mobile and desktop.
    *   Clear, neutral UI feedback for actions like submitting an answer.
*   **Live Player Status:** See exactly who has answered during the round in real-time.
*   **Persistent Settings:** Your custom room configurations and preferred genres are saved locally for convenience.

## Tech Stack

**Frontend:**
* React 18 & Next.js 14 (App Router)
* TypeScript
* Tailwind CSS (Custom thematic design)
* Native WebSockets

**Backend:**
* Python 3.10+
* FastAPI (REST & WebSocket endpoints)
* Uvicorn (ASGI server)
* HTTPX (Async requests for proxying covers and scraping)

## Prerequisites

* [Node.js](https://nodejs.org/) (v18 or higher)
* [Python](https://www.python.org/downloads/) (v3.10 or higher)

## Local Setup & Installation

The project is split into two independent services that must be run simultaneously.

### 1. Backend Setup

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. (Optional but recommended) Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/Scripts/activate  # On Windows
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   python main.py
   ```
   *The backend will now be running on `http://localhost:8000`.*

### 2. Frontend Setup

1. Open a **new** terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   *The frontend will now be running on `http://localhost:3000`.*

## How to Play

1. Open `http://localhost:3000` in your web browser.
2. **Host a Game:** Click "Create Room" to start a quick match, or "Custom Room" to tweak the settings (genres, difficulty, rounds). Share the 6-character room code with your friends.
3. **Join a Game:** Enter your name and the room code provided by the host.
4. **Gameplay:** A Manhwa cover will appear. Type the correct title into the input box before the timer runs out. You will earn points based on how accurate and fast you are.
5. **Winning:** The player with the most points at the end of the final round wins!

## Updating the Manhwa Pool

The game uses a local JSON database of Manhwa. To update this list with the latest data from MangaDex (including covers, ratings, views, and genres), you must use the `scraper` source.

1. Ensure your backend virtual environment is active.
2. Run the update script from the `backend` directory:
   ```bash
   cd backend
   python -m scripts.update_pool --source scraper --limit 200
   ```

---
## ⚠️ Disclaimer

This repository contains code generated with the assistance of AI. It may contain bugs, inaccuracies, or suboptimal implementations.  