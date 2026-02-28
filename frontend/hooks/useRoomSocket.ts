"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWsUrl } from "@/lib/api";

export type RoomPhase = "lobby" | "playing" | "results";
export type Player = { id: string; name: string; score: number };

export type RoomState = {
  room_code: string;
  owner_id: string;
  players: Player[];
  phase: RoomPhase;
  round_index: number;
  rounds_total: number;
  seconds_per_round: number;
  points_exact: number;
  points_fuzzy: number;
  max_players: number;
  suggestions_enabled: boolean;
  difficulty: "easy" | "medium" | "hard";
  genres: string[] | null;
  current_question: { manga_id: string; title: string; cover_filename: string } | null;
  answered_players: string[];
  round_ends_at: number;
  results: Array<{ correct_title: string; scores: { player_id: string; name: string; score: number }[]; answers: Record<string, string> }>;
};

type WsMessage =
  | { event: "joined"; player_id: string; owner_id: string; state: RoomState }
  | { event: "room_state"; state: RoomState }
  | { event: "round_start"; state: RoomState }
  | { event: "tick"; seconds_left: number }
  | { event: "answer_received" }
  | { event: "round_end"; result: RoomState["results"][0] }
  | { event: "game_over"; results: RoomState["results"]; scores: { player_id: string; name: string; score: number }[] }
  | { event: "error"; message: string };

function getStoredPlayerId(roomCode: string): string {
  const key = `manhwa-quiz-pid-${roomCode.toUpperCase()}`;
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = "p_" + Math.random().toString(36).substring(2, 12);
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function useRoomSocket(roomCode: string, playerName: string, ownerId: string | null) {
  const [state, setState] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [ownerIdFromServer, setOwnerIdFromServer] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "reconnecting" | "disconnected">("connecting");
  const [lastResult, setLastResult] = useState<RoomState["results"][0] | null>(null);
  const [gameOverScores, setGameOverScores] = useState<{ player_id: string; name: string; score: number }[] | null>(null);
  const [isBetweenRounds, setIsBetweenRounds] = useState(false);
  const [mounted, setMounted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const isActiveRef = useRef(true);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const code = roomCode.trim().toUpperCase();
  const name = playerName.trim();

  // 1. Only connect after component is mounted on the client (avoids SSR hydration issues)
  useEffect(() => {
    setMounted(true);
  }, []);

  const connect = useCallback(() => {
    if (!mounted || !code || !name) return;
    
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    setConnectionStatus((prev) => prev === "connected" ? "connected" : "connecting");

    // We only execute this on the client because `mounted` is true
    const pId = getStoredPlayerId(code);
    setPlayerId(pId);

    const base = getWsUrl().replace(/^http/, "ws");
    const params = new URLSearchParams({
      room_code: code,
      player_name: name,
      player_id: pId, // Guaranteed to be present now
    });
    if (ownerId) {
      params.set("owner_id", ownerId);
    }

    const wsUrl = `${base}/ws?${params.toString()}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isActiveRef.current) {
        ws.close();
        return;
      }
      setConnectionStatus("connected");
    };

    ws.onmessage = (event) => {
      if (!isActiveRef.current) return;
      try {
        const msg: WsMessage = JSON.parse(event.data);
        if (msg.event === "joined") {
          setOwnerIdFromServer(msg.owner_id);
          setState(msg.state);
          setLastResult(null);
          setGameOverScores(null);
        } else if (msg.event === "room_state") {
          setState(msg.state);
        } else if (msg.event === "round_start") {
          setIsBetweenRounds(false);
          setState(msg.state);
          setSecondsLeft(Math.max(0, Math.ceil(msg.state.round_ends_at - Date.now() / 1000)));
          setLastResult(null);
        } else if (msg.event === "tick") {
          setSecondsLeft(msg.seconds_left);
        } else if (msg.event === "round_end") {
          setIsBetweenRounds(true);
          setSecondsLeft(0);
          setLastResult(msg.result);
          setState((s) => (s ? { ...s, results: [...s.results, msg.result] } : null));
        } else if (msg.event === "game_over") {
          setIsBetweenRounds(false);
          setGameOverScores(msg.scores);
          setLastResult(msg.results[msg.results.length - 1] ?? null);
          setState((s) => (s ? { ...s, phase: "results" as const } : null));
        } else if (msg.event === "error") {
          if (msg.message === "room_not_found" || msg.message === "join_failed") {
            isActiveRef.current = false;
          }
          setConnectionStatus("disconnected");
        }
      } catch (err) {
        // ignore
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (!isActiveRef.current) return;
      
      setConnectionStatus("reconnecting");
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isActiveRef.current) connect();
      }, 2000);
    };

    ws.onerror = () => {};
  }, [code, name, ownerId, mounted]);

  useEffect(() => {
    isActiveRef.current = true;
    connect();

    return () => {
      isActiveRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendStart = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "start_game" }));
    }
  }, []);

  const sendAnswer = useCallback((answer: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "submit_answer", answer }));
    }
  }, []);

  const isOwner = Boolean(ownerId && ownerId === ownerIdFromServer);

  return {
    state,
    playerId,
    isOwner,
    secondsLeft,
    connectionStatus,
    lastResult,
    gameOverScores,
    isBetweenRounds,
    sendStart,
    sendAnswer,
    reconnect: connect,
  };
}
