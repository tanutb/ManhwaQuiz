# Technical Documentation: Manhwa Quiz

This document details the architectural decisions, complex state management, and critical data flows within the Manhwa Quiz application.

## 1. System Architecture Overview

The application utilizes a client-server architecture with two primary communication channels:
1.  **REST API (HTTP):** Used for initial setup (creating/checking rooms), fetching static data (genres, autocomplete suggestions), and proxying images to bypass CORS.
2.  **WebSockets (WS):** Used for the entirety of the game loop. It provides full-duplex, real-time communication between the clients and the server's central state machine.

---

## 2. Backend Architecture (FastAPI)

The backend is built with FastAPI, taking advantage of its native async support to handle multiple simultaneous WebSocket connections efficiently.

### 2.1 The State Machine (`RoomManager`)
The core of the backend is the `RoomManager` singleton found in `services/room_manager.py`. It holds the game state entirely in memory.

*   **`RoomState` Dataclass:** Represents a single game room. It tracks the `phase` ("lobby", "playing", "results"), the `round_index`, the current list of `questions`, and all active `players`.
*   **Game Loop:** The loop is driven by `_run_round_timer` in `main.py`. This async task spins up when a game starts. It counts down the timer, automatically transitions the room to the "results" phase when time expires (or when all players answer), waits a few seconds, and triggers the next round.
*   **State Broadcasting:** Any action that mutates a room's state (joining, answering, timer ticking) triggers `_broadcast_room_state`, which serializes the `RoomState` and pushes it to all connected WebSockets in that room.

### 2.2 Connection Management & Race Condition Handling
WebSocket connection lifecycle in modern web apps (especially with React) is highly volatile. The backend employs strict logic to prevent ghost users and infinite reconnect loops.

*   **Deterministic IDs:** The backend does *not* generate player IDs on connect. It demands the frontend provide a stable `player_id`.
*   **Active Connection Tracking:** The `RoomManager` maintains a `_player_to_ws` dictionary. This maps a specific `player_id` to their *single, most recently opened* WebSocket ID.
*   **Delayed Cleanup (Grace Period):** When a WebSocket drops, the server does not immediately delete the player. Instead, `main.py` schedules an async `delayed_cleanup` task for 3 seconds.
    *   If the user refreshes the page, their new connection replaces the old one in the `_player_to_ws` map within that 3 seconds.
    *   When the cleanup task executes, it calls `remove_player_if_inactive`. This checks if the user has a *new* active connection. If they do, they are spared. If not, they are deleted.

### 2.3 Search Algorithm (`TitleIndex`)
Auto-suggestions are powered by an in-memory index in `services/pool.py`. When the server starts, it loads the `manhwa_pool.json` into a `TitleIndex` class.

*   **Matching Logic:** The search is a highly optimized linear pass. It first scans for strings that *start with* the user's query (prioritizing exact prefixes). It then does a second pass for *substring* matches (e.g., "leveling" matches "Solo Leveling").
*   **Data Structure:** By maintaining a unique, flat list of lowercase titles in memory, the API endpoint `/api/suggest` can respond to keystrokes in milliseconds without database overhead.

---

## 3. Frontend Architecture (Next.js & React)

The frontend is a React application built on the Next.js 14 App Router.

### 3.1 Connection Lifecycle (`useRoomSocket`)
The most complex part of the frontend is the custom hook `useRoomSocket.ts`. It acts as the bridge between the React UI and the backend state machine.

*   **Strict Mode Immunity:** React Strict Mode intentionally mounts and unmounts components instantly. To prevent this from creating duplicate WebSocket connections:
    1.  **Device Fingerprinting:** The hook uses a helper to read/write a permanent `device_id` to the browser's `localStorage`.
    2.  **Stable Player ID:** The `player_id` sent to the server is deterministically constructed as `${roomCode}_${deviceId}`.
    3.  **Ref Control Flow:** React `useState` is too slow for WebSocket lifecycles. The hook uses `useRef` (`wsRef`, `isActiveRef`, `isConnectingRef`) to track the connection instantly and synchronously, preventing race conditions where the component unmounts while a connection is pending.
*   **Aggressive Teardown:** In the `useEffect` cleanup function, before calling `ws.close()`, the code sets `ws.onmessage = null` and `ws.onclose = null`. This guarantees that an orphaned WebSocket from a previous render cannot trigger state updates or start a rogue reconnect loop.

### 3.2 Dynamic UI and State Separation
The `RoomPage` (`app/room/[code]/page.tsx`) receives a single object (`state`) from the `useRoomSocket` hook.

*   **Phase Rendering:** The UI is purely a reflection of `state.phase`. It renders `<LobbyView>`, `<PlayingView>`, or `<ResultsView>` based strictly on what the server dictates.
*   **Optimistic Updates:** While the server controls the absolute state, the frontend utilizes local state (like the `answered` variable in `RoomPage`) to instantly show the user that their input was received, resulting in a snappier user experience before the server broadcasts the global confirmation.
*   **Debounced Inputs:** The `<AnswerCombobox>` uses a generic `setTimeout` ref strategy to debounce user keystrokes by 50ms, drastically reducing the load on the `/api/suggest` REST endpoint while typing.
