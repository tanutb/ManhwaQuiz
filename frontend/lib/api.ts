const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "secret";

export function getApiUrl(): string {
  return API_URL;
}

export function getWsUrl(): string {
  return WS_URL;
}

export type CreateRoomPayload = {
  room_code?: string;
  rounds_total?: number;
  seconds_per_round?: number;
  points_exact?: number;
  points_fuzzy?: number;
  max_players?: number;
  suggestions_enabled?: boolean;
  difficulty?: "easy" | "medium" | "hard";
  genres?: string[] | null;
};

export async function createRoom(payload?: CreateRoomPayload): Promise<{ room_code: string; owner_id: string }> {
  const r = await fetch(`${API_URL}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify(payload ?? {}),
  });
  if (!r.ok) throw new Error("Failed to create room");
  const data = await r.json();
  if (data?.error) throw new Error(data.message || data.error);
  return data;
}

export async function checkRoom(roomCode: string): Promise<{ exists: boolean }> {
  const r = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(roomCode.toUpperCase())}`, {
    headers: { "X-API-Key": API_KEY },
  });
  if (!r.ok) return { exists: false };
  return r.json();
}

export async function getGenres(): Promise<string[]> {
  try {
    const r = await fetch(`${API_URL}/api/genres`, {
      headers: { "X-API-Key": API_KEY },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return data.genres || [];
  } catch {
    return [];
  }
}

export async function getSuggestions(q: string, roomCode?: string): Promise<string[]> {
  const params = new URLSearchParams({ q, limit: "10" });
  if (roomCode) params.set("room_code", roomCode);
  const r = await fetch(`${API_URL}/api/suggest?${params}`, {
    headers: { "X-API-Key": API_KEY },
  });
  if (!r.ok) return [];
  const data = await r.json();
  return data.suggestions || [];
}

export function getCoverUrl(mangaId: string, coverFilename: string): string {
  const file = coverFilename.includes(".256.") ? coverFilename : `${coverFilename}.256.jpg`;
  return `${API_URL}/api/covers/${mangaId}/${file}`;
}

export async function fetchCoverAsBlob(mangaId: string, coverFilename: string): Promise<string> {
  const url = getCoverUrl(mangaId, coverFilename);
  const r = await fetch(url, { headers: { "X-API-Key": API_KEY } });
  if (!r.ok) return ""; // Return empty string or a placeholder URL
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}

