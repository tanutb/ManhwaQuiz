# Project Structure

This document outlines the directory structure of the Manhwa Quiz application and explains the purpose of each key folder and file.

```text
manhwa-quiz/
|-- backend/                 # Python FastAPI Server
|   |-- data/                # Static data storage
|   |   +-- manhwa_pool.json # The database of manhwa (compiled via scripts)
|   |-- scripts/             # Utility scripts
|   |   |-- scrape_manhwa.py # Fallback HTML scraper
|   |   +-- update_pool.py   # CLI tool to fetch and update manhwa_pool.json
|   |-- services/            # Core business logic
|   |   |-- mangadex.py      # MangaDex API integration for fetching data
|   |   |-- pool.py          # Data loading, search index, and scoring logic
|   |   +-- room_manager.py  # WebSocket state machine, player tracking, game flow
|   |-- config.py            # Pydantic settings (CORS, defaults)
|   |-- main.py              # FastAPI entry point (REST routes & WS endpoint)
|   +-- requirements.txt     # Python dependencies
|
|-- frontend/                # React / Next.js Application
|   |-- app/                 # Next.js App Router (Pages & Layouts)
|   |   |-- room/
|   |   |   +-- [code]/      
|   |   |       +-- page.tsx # The main game room interface (Lobby, Playing, Results)
|   |   |-- globals.css      # Tailwind design system, custom themes, and animations
|   |   |-- layout.tsx       # Root HTML shell
|   |   +-- page.tsx         # The landing page (Create/Join forms, Custom settings)
|   |-- components/          # Reusable UI components
|   |   |-- AnswerCombobox.tsx # The text input with auto-suggestions
|   |   +-- TimerBar.tsx     # Visual countdown timer
|   |-- hooks/               # Custom React hooks
|   |   +-- useRoomSocket.ts # Complex WebSocket lifecycle and state management
|   |-- lib/                 # Utility functions
|   |   +-- api.ts           # HTTP fetch wrappers for REST endpoints
|   |-- tailwind.config.ts   # Tailwind configuration
|   +-- package.json         # Node dependencies
|
|-- README.md                # High-level overview and setup
|-- STRUCTURE.md             # This file
+-- technical_doc.md         # In-depth architectural documentation
```

## Key Architectural Boundaries

### The Backend (`backend/`)
The backend is stateless regarding the persistent database (it uses an in-memory JSON load), but highly stateful regarding active WebSocket connections. `room_manager.py` acts as the central source of truth for the entire game state of all active rooms.

### The Frontend (`frontend/`)
The frontend is a thick client. While it receives its definitive state from the server via WebSockets, it handles complex local operations such as:
* Maintaining a persistent cross-refresh identity (`sessionStorage` / `localStorage`).
* Managing optimistic UI updates (e.g., showing the "Answered" state instantly).
* Debouncing input for the auto-suggestion API.
