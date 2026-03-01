"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getCoverUrl, fetchCoverAsBlob } from "@/lib/api";
import { useRoomSocket, type Player, type RoomState } from "@/hooks/useRoomSocket";
import AnswerCombobox from "@/components/AnswerCombobox";
import TimerBar from "@/components/TimerBar";

// ── Small, shared components ───────────────────────────────────────────────

function Spinner() {
  return (
    <div className="w-8 h-8 rounded-full border-2 border-[var(--border-bright)] border-t-[var(--primary)] animate-spin-slow" />
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
      <Spinner />
      <p className="text-sm text-[var(--text-muted)] animate-fade-in">{message}</p>
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  const ok = status === "connected";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
        ok ? "bg-[var(--success-bg)] text-[var(--success)]" : "bg-white/5 text-[var(--text-muted)]"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-[var(--success)]" : "bg-[var(--text-muted)]"}`} />
      {ok ? "Live" : status}
    </span>
  );
}

function ConfigChip({ label }: { label: string }) {
  return (
    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--primary-dim)] text-[var(--primary)] border border-[var(--primary)]/20">
      {label}
    </span>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.slice(0, 1).toUpperCase();
  const sz = size === "sm" ? "w-8 h-8 text-sm" : size === "lg" ? "w-12 h-12 text-lg" : "w-10 h-10 text-base";
  const colors = [
    "from-indigo-500 to-purple-600", "from-pink-500 to-rose-600", "from-amber-500 to-orange-600",
    "from-teal-500 to-cyan-600", "from-emerald-500 to-green-600",
  ];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <span
      className={`${sz} rounded-full bg-gradient-to-br ${color} flex items-center justify-center font-semibold text-white flex-shrink-0 ring-2 ring-white/10`}
    >
      {initials}
    </span>
  );
}

// ── Main page structure ────────────────────────────────────────────────────

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const code = (params?.code as string) || "";
  const nameFromQuery = searchParams?.get("name") || "";
  const ownerId = searchParams?.get("owner_id") || null;

  const [name, setName] = useState(nameFromQuery);
  const [nameSubmitted, setNameSubmitted] = useState(!!nameFromQuery);

  const { state, playerId, ...socket } = useRoomSocket(code, nameSubmitted ? name || "Player" : "", ownerId);
  const [answered, setAnswered] = useState<string | false>(false);

  useEffect(() => {
    if (state?.phase === "playing" && state.current_question) {
      setAnswered(false);
    }
  }, [state?.phase, state?.round_index]);

  const handleSubmitAnswer = useCallback((answer: string) => {
    if (!answer.trim()) return;
    socket.sendAnswer(answer.trim());
    setAnswered(answer.trim());
  }, [socket.sendAnswer]);

  if (!code) return <ErrorMessage message="Invalid room code." showLobbyLink />;
  if (!nameSubmitted) return <NameEntryForm code={code} name={name} setName={setName} setNameSubmitted={setNameSubmitted} />;
  
  if (socket.connectionStatus === "connecting" || socket.connectionStatus === "reconnecting") {
    return <LoadingScreen message={socket.connectionStatus === "reconnecting" ? "Reconnecting…" : "Connecting…"} />;
  }
  if (socket.connectionStatus === "disconnected" && !state) {
    return <ErrorMessage message="Connection lost." showLobbyLink showRetry onRetry={socket.reconnect} />;
  }
  if (!state || !playerId) return <LoadingScreen message="Joining room…" />;

  const inLobby = state.phase === "lobby";
  const playing = state.phase === "playing" && state.current_question && !socket.isBetweenRounds;
  const showResults = socket.lastResult && (socket.isBetweenRounds || state.phase === "results");

  return (
    <main className="min-h-screen max-w-3xl mx-auto p-4 space-y-4">
      <Header code={code} status={socket.connectionStatus} state={state} />
      {inLobby     && <LobbyView state={state} playerId={playerId} isOwner={socket.isOwner} onStart={socket.sendStart} />}
      {playing     && <PlayingView state={state} playerId={playerId} secondsLeft={socket.secondsLeft} answered={answered} onSubmit={handleSubmitAnswer} />}
      {showResults && <ResultsView state={state} playerId={playerId} lastResult={socket.lastResult!} gameOverScores={socket.gameOverScores} />}
    </main>
  );
}

// ── Page components ────────────────────────────────────────────────────────

function Header({ code, status, state }: { code: string; status: string; state: RoomState }) {
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-[var(--text-muted)] hover:text-white text-xl leading-none">←</Link>
        <div>
          <span className="text-xl font-mono font-bold tracking-[0.2em]">{code.toUpperCase()}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={copyLink}
          title="Copy invite link"
          className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] px-2.5 py-1 rounded-lg hover:bg-[var(--primary-dim)]"
        >
          {copied ? "✓ Copied" : "Copy Link"}
        </button>
        <StatusPill status={status} />
      </div>
    </div>
  );
}

function LobbyView({ state, playerId, isOwner, onStart }: { state: RoomState; playerId: string; isOwner: boolean; onStart: () => void; }) {
  return (
    <div className="glass rounded-2xl p-6 space-y-6 animate-pop-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Waiting Room</h2>
        <div className="flex flex-wrap gap-2 justify-end">
          <ConfigChip label={`${state.rounds_total} rounds`} />
          <ConfigChip label={`${state.seconds_per_round}s`} />
          <ConfigChip label={state.difficulty} />
          {state.genres?.map((g) => <ConfigChip key={g} label={g} />)}
        </div>
      </div>
      <PlayerList state={state} playerId={playerId} />
      {isOwner ? (
        <button
          type="button"
          onClick={onStart}
          disabled={state.players.length < 2}
          title={state.players.length < 2 ? "Need at least 2 players" : ""}
          className={`w-full py-3.5 rounded-xl font-semibold text-base transition-all ${
            state.players.length >= 2
              ? "bg-[var(--primary)] hover:bg-[var(--primary-hover)] animate-pulse-ring"
              : "bg-white/10 text-[var(--text-muted)] cursor-not-allowed"
          }`}
        >
          {state.players.length < 2 ? "Waiting for players..." : "Start Game"}
        </button>
      ) : (
        <p className="text-center text-sm text-[var(--text-muted)]">Waiting for the host to start the game…</p>
      )}
    </div>
  );
}

function PlayerList({ state, playerId }: { state: RoomState; playerId: string }) {
  return (
    <ul className="space-y-3">
      {state.players.map((p) => {
        const hasAnswered = state.phase === "playing" && state.answered_players?.includes(p.id);
        return (
          <li
            key={p.id}
            className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-[var(--card-hover)] border border-[var(--border)]"
          >
            <div className="flex items-center gap-4">
              <Avatar name={p.name} />
              <span className="font-medium">{p.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {hasAnswered && <span className="text-xs font-semibold text-[var(--success)]">✓ Answered</span>}
              {p.id === state.owner_id && <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--primary)]">Host</span>}
              {p.id === playerId && <span className="text-xs text-[var(--text-dim)]">You</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AuthenticatedImage({
  mangaId,
  coverFilename,
  onImageClick,
}: {
  mangaId: string;
  coverFilename: string;
  onImageClick: (url: string) => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let objectUrl: string | null = null;

    const fetchImage = async () => {
      try {
        const url = await fetchCoverAsBlob(mangaId, coverFilename);
        if (isMounted) {
          objectUrl = url;
          setImageUrl(url);
        }
      } catch (error) {
        console.error("Failed to fetch image:", error);
        if (isMounted) {
          setImageUrl(null); // Or a placeholder error image URL
        }
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [mangaId, coverFilename]);

  if (!imageUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/20">
        <Spinner />
      </div>
    );
  }

  return (
    <div
      onClick={() => imageUrl && onImageClick(imageUrl)}
      className="absolute inset-0 cursor-pointer z-10"
    >
      <Image
        src={imageUrl}
        alt="Manhwa cover"
        fill
        className="object-cover"
        unoptimized
      />
    </div>
  );
}

function PlayingView({
  state,
  playerId,
  secondsLeft,
  answered,
  onSubmit,
}: {
  state: RoomState;
  playerId: string;
  secondsLeft: number | null;
  answered: string | false;
  onSubmit: (v: string) => void;
}) {
  const { current_question: q } = state;
  const [popupImageUrl, setPopupImageUrl] = useState<string | null>(null);
  if (!q) return null;

  return (
    <>
      <div className="glass rounded-2xl p-4 sm:p-6 space-y-5 animate-pop-in">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-[var(--text-dim)]">
            Round {state.round_index + 1} / {state.rounds_total}
          </span>
          <span className="text-xs text-[var(--text-muted)]">{state.players.length} players</span>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-[var(--card)] ring-2 ring-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)] max-h-[56vh] aspect-[3/4] mx-auto w-full max-w-xs">
          {/* Overlays are now rendered first, so they are in the background */}
          <div
            style={{ background: "radial-gradient(circle, transparent 60%, rgba(0,0,0,0.8))" }}
            className="absolute inset-0"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          
          {/* The clickable image is rendered last, so it is on top */}
          <AuthenticatedImage
            mangaId={q.manga_id}
            coverFilename={q.cover_filename}
            onImageClick={setPopupImageUrl}
          />
          
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-semibold z-20">
            Round {state.round_index + 1}
          </div>
        </div>

        <TimerBar secondsLeft={secondsLeft} maxSeconds={state.seconds_per_round} />

        <div className="space-y-3">
          {answered && (
            <div className="flex flex-col items-center justify-center gap-1.5 text-[var(--primary)] animate-pop-in bg-[var(--primary-dim)] border border-[var(--primary)]/20 px-4 py-3 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none">✓</span>
                <p className="text-sm font-semibold">Answer submitted! You can still change it.</p>
              </div>
              <p className="text-xs text-[var(--primary)]/80">
                You answered: <span className="font-semibold text-white">{answered}</span>
              </p>
            </div>
          )}
          <AnswerCombobox
            onSubmit={onSubmit}
            disabled={secondsLeft === 0}
            roomCode={state.room_code}
            suggestionsEnabled={state.suggestions_enabled}
          />
        </div>

        <div className="pt-2 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-3">Players Status</p>
          <PlayerList state={state} playerId={playerId} />
        </div>
      </div>
      {popupImageUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in p-4 sm:p-8"
          onClick={() => setPopupImageUrl(null)}
        >
          <div className="relative w-full h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={popupImageUrl}
              alt="Manhwa cover full size"
              className="w-full h-full object-contain rounded-lg shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setPopupImageUrl(null)}
              className="absolute top-2 right-2 text-white bg-slate-800/80 rounded-full p-2 leading-none hover:bg-slate-700/90 focus:outline-none focus:ring-2 focus:ring-white z-10"
              aria-label="Close image view"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ResultsView({ state, playerId, lastResult, gameOverScores }: { state: RoomState; playerId: string; lastResult: RoomState["results"][0]; gameOverScores: { player_id: string; name: string; score: number }[] | null; }) {
  const gameOver = !!gameOverScores;

  if (gameOver) {
    return <GameOverView scores={gameOverScores!} playerId={playerId} />;
  }

  const myAnswer = lastResult.answers[playerId] ?? null;
  const myPrevScore = state.results.length > 1 ? state.results[state.results.length-2].scores.find(s=>s.player_id===playerId)?.score ?? 0 : 0;
  const myCurrentScore = lastResult.scores.find(s => s.player_id === playerId)?.score ?? 0;
  const pointsGained = myCurrentScore - myPrevScore;

  return (
    <div className="glass rounded-2xl p-6 space-y-6 animate-pop-in">
      <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8 border-2 border-[var(--success)]/50 bg-gradient-to-b from-[var(--success-bg)] to-transparent flex flex-col items-center justify-center gap-3 animate-pop-in shadow-[0_0_40px_rgba(34,197,94,0.2)]">
        <div className="flex items-center gap-2 text-[var(--success)] relative z-10">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--success)] text-[var(--bg)] text-sm font-bold shadow-[0_0_15px_rgba(34,197,94,0.6)]">✓</span>
          <p className="text-xs font-bold uppercase tracking-widest drop-shadow-sm">Correct Answer</p>
        </div>
        <h3 className="text-3xl sm:text-4xl font-black text-center text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] relative z-10 tracking-tight">
          {lastResult.correct_title}
        </h3>
      </div>

      <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${pointsGained > 0 ? "bg-[var(--success-bg)] border-[var(--success)]/25" : "bg-[var(--error-bg)] border-[var(--error)]/25"}`}>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Your answer</p>
          <p className="font-semibold">{myAnswer || "—"}</p>
        </div>
        <span className={`text-lg font-bold ${pointsGained > 0 ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
          +{pointsGained}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Leaderboard</p>
        {lastResult.scores.slice().sort((a, b) => b.score - a.score).map((s) => (
          <div key={s.player_id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5">
            <div className="flex items-center gap-3">
              <Avatar name={s.name} size="sm" />
              <span className="text-sm font-medium">{s.name} {s.player_id === playerId && "(you)"}</span>
            </div>
            <span className="text-sm font-semibold tabular-nums">{s.score} pts</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-[var(--text-dim)] animate-pulse">Next round starting…</p>
    </div>
  );
}

function GameOverView({ scores, playerId }: { scores: { player_id: string; name: string; score: number }[], playerId: string }) {
  const ranked = scores.slice().sort((a, b) => b.score - a.score);
  const medal = (i: number) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
  const medalColor = (i: number) => i === 0 ? "border-[var(--gold)] text-[var(--gold)]" : i === 1 ? "border-[var(--silver)] text-[var(--silver)]" : i === 2 ? "border-[var(--bronze)] text-[var(--bronze)]" : "border-[var(--border)]";

  return (
    <div className="glass rounded-2xl p-6 space-y-6 animate-pop-in">
      <div className="text-center space-y-1">
        <div className="text-5xl mb-2">🏆</div>
        <h2 className="text-3xl font-extrabold">Game Over!</h2>
        <p className="text-sm text-[var(--text-muted)]">Final standings</p>
      </div>
      <div className="space-y-2">
        {ranked.map((s, i) => (
          <div key={s.player_id} className={`flex items-center justify-between py-3 px-4 rounded-xl border-2 transition-all ${medalColor(i)} ${i < 3 ? "bg-black/20" : "bg-transparent"}`}>
            <div className="flex items-center gap-3">
              <span className={`text-lg font-black w-7 text-center ${i > 2 && "text-[var(--text-dim)]"}`}>{medal(i)}</span>
              <Avatar name={s.name} size={i === 0 ? "lg" : "md"} />
              <div>
                <p className="font-semibold">{s.name}</p>
                {s.player_id === playerId && <p className="text-xs text-[var(--text-dim)]">that&apos;s you!</p>}
              </div>
            </div>
            <span className="text-base font-bold tabular-nums">{s.score} pts</span>
          </div>
        ))}
      </div>
      <Link href="/" className="block w-full py-3.5 text-center rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] font-semibold">
        Back to Lobby
      </Link>
    </div>
  );
}

// ── Standalone forms / error states ────────────────────────────────────────

function NameEntryForm({ code, name, setName, setNameSubmitted }: { code: string; name: string; setName: (n: string) => void; setNameSubmitted: (s: boolean) => void; }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm glass rounded-2xl p-8 space-y-6 animate-pop-in">
        <div>
          <h2 className="text-2xl font-bold">Join Room</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Room code: <span className="font-mono font-semibold text-white tracking-widest">{code.toUpperCase()}</span>
          </p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) setNameSubmitted(true); }}>
          <label htmlFor="name" className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Your Name</label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="e.g. Sung Jin-Woo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            autoFocus
            className="w-full py-3 px-4 rounded-xl bg-black/20 border border-[var(--border)] text-base placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full mt-4 py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] font-semibold disabled:opacity-40"
          >
            Enter Room
          </button>
        </form>
      </div>
    </main>
  );
}

function ErrorMessage({ message, showLobbyLink, showRetry, onRetry }: { message: string; showLobbyLink?: boolean; showRetry?: boolean; onRetry?: () => void; }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-5 p-4">
      <div className="text-center space-y-2">
        <div className="text-4xl">🔌</div>
        <h2 className="text-xl font-semibold">Error</h2>
        <p className="text-sm text-[var(--text-muted)]">{message}</p>
      </div>
      <div className="flex gap-3">
        {showRetry && <button type="button" onClick={onRetry} className="px-5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-sm font-semibold">Retry</button>}
        {showLobbyLink && <Link href="/" className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold">Lobby</Link>}
      </div>
    </main>
  );
}
