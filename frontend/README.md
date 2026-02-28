# Manhwa Quiz - Frontend Client

This directory contains the React frontend for the Manhwa Quiz application, built using the Next.js 14 App Router. It is responsible for the user interface, persistent local settings, and rendering real-time updates broadcast by the backend WebSocket server.

## Core Architecture

*   **Next.js App Router:** The application uses modern file-system based routing (`app/page.tsx` for the lobby, `app/room/[code]/page.tsx` for the active game interface).
*   **WebSocket Hook (`hooks/useRoomSocket.ts`):** This is the most critical piece of the frontend. It manages a highly robust WebSocket lifecycle, utilizing deterministic `device_id` generation (stored in `localStorage`) to completely prevent duplicate users or infinite reconnect loops caused by React Strict Mode and Hot Module Replacement (HMR).
*   **Styling:** The UI is completely custom-designed using Tailwind CSS (`app/globals.css`), featuring a dark "Deep Space" theme, glassmorphism UI elements, and custom CSS keyframe animations for polished interactions.
*   **Optimistic UI:** The client performs local visual updates (like instantly showing an "Answered" badge or debouncing search input) to ensure the interface feels incredibly snappy even on slower networks.

## Local Development Setup

1. **Prerequisites:** Ensure you have Node.js (v18+) installed.
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:3000`.

*Note: The frontend requires the Python backend to be running concurrently on `http://localhost:8000` for API calls and WebSocket connections to succeed.*
