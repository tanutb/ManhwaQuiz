"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRoom, checkRoom, getGenres, type CreateRoomPayload } from "@/lib/api";

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-[var(--border)] rounded-lg appearance-none cursor-pointer"
        />
        <span className="absolute -top-1 -right-1 text-xs font-mono bg-[var(--card-elevated)] px-1.5 py-0.5 rounded">
          {value}
        </span>
      </div>
    </div>
  );
}

function loadCustomSettings(): CreateRoomPayload {
  if (typeof window === "undefined") {
    return {
      rounds_total: 10,
      seconds_per_round: 20,
      points_exact: 100,
      points_fuzzy: 50,
      max_players: 8,
      suggestions_enabled: true,
      room_code: "",
      difficulty: "medium",
      genres: [],
    };
  }
  const saved = localStorage.getItem("manhwa-quiz-custom-settings");
  if (saved) {
    try {
      return { ...JSON.parse(saved), room_code: "" };
    } catch {
      // ignore
    }
  }
  return {
    rounds_total: 10,
    seconds_per_round: 20,
    points_exact: 100,
    points_fuzzy: 50,
    max_players: 8,
    suggestions_enabled: true,
    room_code: "",
    difficulty: "medium",
    genres: [],
  };
}

export default function LobbyPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [createMode, setCreateMode] = useState<"quick" | "custom">("quick");
  
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  
  const [custom, setCustom] = useState<CreateRoomPayload>(loadCustomSettings);

  // Save settings whenever they change
  useEffect(() => {
    localStorage.setItem("manhwa-quiz-custom-settings", JSON.stringify(custom));
  }, [custom]);
  
  const [loading, setLoading] = useState<"create" | "custom" | "join" | null>(null);
  const [error, setError] = useState("");
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);

  useEffect(() => {
    getGenres().then(setGenres);
  }, []);

  const handleCreate = async () => {
    setError("");
    setLoading("create");
    try {
      const { room_code, owner_id } = await createRoom();
      router.push(`/room/${room_code}?owner_id=${encodeURIComponent(owner_id)}`);
    } catch {
      setError("Could not create room. Is the server running?");
      setLoading(null);
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if ((custom.points_fuzzy ?? 0) > (custom.points_exact ?? 0)) {
      setError("Fuzzy points cannot be higher than exact points.");
      return;
    }
    setLoading("custom");
    try {
      const payload: CreateRoomPayload = {
        ...custom,
        room_code: custom.room_code?.trim().toUpperCase() || undefined,
      };
      const { room_code, owner_id } = await createRoom(payload);
      router.push(`/room/${room_code}?owner_id=${encodeURIComponent(owner_id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create custom room.");
      setLoading(null);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const code = joinCode.trim().toUpperCase();
    if (!code) { setError("Enter a room code."); return; }
    setLoading("join");
    try {
      const { exists } = await checkRoom(code);
      if (!exists) { setError("Room not found."); setLoading(null); return; }
      const name = joinName.trim() || "Player";
      router.push(`/room/${code}?name=${encodeURIComponent(name)}`);
    } catch {
      setError("Could not join room. Is the server running?");
      setLoading(null);
    }
  };

  const setField = (key: keyof CreateRoomPayload, value: unknown) =>
    setCustom((prev) => ({ ...prev, [key]: value }));

  const handleGenreToggle = (genre: string) => {
    setCustom((prev) => {
      const currentGenres = prev.genres || [];
      const newGenres = currentGenres.includes(genre)
        ? currentGenres.filter((g) => g !== genre)
        : [...currentGenres, genre];
      return { ...prev, genres: newGenres };
    });
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 py-10">
      <div className="text-center mb-8 animate-fade-in">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tighter bg-gradient-to-br from-[var(--primary)] via-[var(--primary-hover)] to-[var(--secondary)] bg-clip-text text-transparent">
          Manhwa Quiz
        </h1>
        <p className="text-[var(--text-muted)] mt-2">
          Guess the title from the cover. Multiplayer. Real-time.
        </p>
      </div>

      <div className="w-full max-w-md glass rounded-2xl p-2 animate-pop-in">
        {/* ── Main mode toggle (Create / Join) ── */}
        <div className="flex items-center gap-1 rounded-xl bg-black/20 p-1 mb-4">
          {(["create", "join"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize ${
                mode === m ? "bg-[var(--card-hover)] text-white shadow-md" : "text-[var(--text-muted)] hover:text-white"
              }`}
            >
              {m} Room
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-center text-[var(--error)] bg-[var(--error-bg)] rounded-lg mx-2 my-3 px-3 py-2" role="alert">
            {error}
          </p>
        )}

        {mode === "create" ? (
          <div className="p-4 pt-2">
            <div className="flex items-center gap-1 rounded-xl bg-black/20 p-1 mb-5">
              {(["quick", "custom"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setCreateMode(m); setError(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                    createMode === m ? "bg-[var(--card-hover)] text-white" : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                  }`}
                >
                  {m} Start
                </button>
              ))}
            </div>

            {createMode === "quick" ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-[var(--text-muted)] px-4">
                  Default settings: Medium difficulty, 10 rounds, 20s each.
                </p>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!!loading}
                  className="w-full py-3.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 font-semibold text-base"
                >
                  {loading === "create" ? "Creating…" : "Create Public Room"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateCustom} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--text-muted)]">Difficulty</label>
                  <div className="flex items-center gap-2 rounded-xl bg-black/20 p-1">
                    {(["easy", "medium", "hard"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setField("difficulty", d)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all capitalize ${
                          custom.difficulty === d
                            ? "bg-[var(--primary-dim)] text-[var(--primary)] ring-1 ring-inset ring-[var(--primary)]/30"
                                                        : "text-[var(--text-muted)] hover:bg-white/5"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                                    </div>
                                  </div>
                  
                                  <div>
                                    <label className="text-sm font-medium text-[var(--text-muted)]">Genres</label>
                                    <div className="flex flex-wrap gap-2 mt-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setField("genres", [])}
                                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                                          !custom.genres?.length ? "bg-[var(--secondary-dim)] text-[var(--secondary)]" : "bg-black/20 text-[var(--text-dim)] hover:bg-black/40"
                                        }`}
                                      >
                                        All
                                      </button>
                                      {genres.map((g) => (
                                        <button
                                          key={g}
                                          type="button"
                                          onClick={() => handleGenreToggle(g)}
                                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                                            custom.genres?.includes(g) ? "bg-[var(--secondary-dim)] text-[var(--secondary)]" : "bg-black/20 text-[var(--text-dim)] hover:bg-black/40"
                                          }`}
                                        >
                                          {g}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-2">
                                    <NumberInput label="Rounds" value={custom.rounds_total ?? 10} onChange={(v) => setField("rounds_total", v)} min={3} max={30} />
                                    <NumberInput label="Seconds" value={custom.seconds_per_round ?? 20} onChange={(v) => setField("seconds_per_round", v)} min={10} max={90} step={5} />
                                    <NumberInput label="Max Players" value={custom.max_players ?? 8} onChange={(v) => setField("max_players", v)} min={2} max={20} />
                                    <div>
                                      <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Custom Code</label>
                                      <input
                                        type="text"
                                        maxLength={8}
                                        value={custom.room_code ?? ""}
                                        onChange={(e) => setField("room_code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                                        placeholder="(Optional)"
                                        className="w-full py-2.5 px-3 rounded-xl bg-black/20 border border-[var(--border)] text-sm font-mono tracking-widest uppercase placeholder:tracking-normal placeholder:font-sans placeholder:capitalize focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                                      />
                                    </div>
                                  </div>
                  
                                  <button
                                    type="submit"
                                    disabled={!!loading}
                                    className="w-full py-3.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 font-semibold text-base"
                                  >
                                    {loading === "custom" ? "Creating…" : "Create Custom Room"}
                                  </button>
                                </form>
                              )}
                            </div>
                          ) : (
                            <form onSubmit={handleJoin} className="space-y-4 p-4 pt-2">
                              <div>
                                <label className="text-sm font-medium text-[var(--text-muted)] block mb-1.5">Your Name</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Sung Jin-Woo"
                                  value={joinName}
                                  onChange={(e) => setJoinName(e.target.value)}
                                  maxLength={24}
                                  className="w-full py-2.5 px-4 rounded-xl bg-black/20 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium text-[var(--text-muted)] block mb-1.5">Room Code</label>
                                <input
                                  type="text"
                                  placeholder="ABCDEF"
                                  value={joinCode}
                                  onChange={(e) => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)); setError(""); }}
                                  maxLength={8}
                                  autoComplete="off"
                                  spellCheck={false}
                                  className="w-full py-3 px-4 rounded-xl bg-black/20 border text-2xl font-mono tracking-[0.3em] text-center uppercase focus:outline-none focus:ring-2 focus:ring-[var(--ring)] placeholder:tracking-normal placeholder:text-xl placeholder:font-sans placeholder:text-[var(--text-dim)]"
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={!!loading || !joinCode.trim()}
                                className="w-full py-3.5 rounded-xl bg-[var(--secondary-dim)] text-[var(--secondary)] hover:bg-[var(--secondary)] hover:text-white disabled:opacity-40 font-semibold transition-all"
                              >
                                {loading === "join" ? "Joining…" : "Join Room"}
                              </button>
                            </form>
                          )}
                  
                          <div className="border-t border-[var(--border)] overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setHowToPlayOpen(!howToPlayOpen)}
                              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-[var(--text-muted)] hover:text-white"
                            >
                              <span>How to Play</span>
                              <span className={`transition-transform ${howToPlayOpen ? "rotate-180" : ""}`}>▼</span>
                            </button>
                            {howToPlayOpen && (
                              <div className="px-5 pb-4 space-y-2 text-sm text-[var(--text-muted)] animate-fade-in">
                                <p>1. <strong className="text-[var(--text)]">Create</strong> a room or <strong className="text-[var(--text)]">Join</strong> with a code.</p>
                                <p>2. When the game starts, you'll see a <strong className="text-[var(--text)]">manhwa cover</strong>.</p>
                                <p>3. <strong className="text-[var(--text)]">Type the title</strong> before the timer runs out.</p>
                                <p>4. <strong className="text-[var(--text)]">Score points</strong> for correct answers. Highest score wins!</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </main>
                    );
                  }
