"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSuggestions } from "@/lib/api";

type Props = {
  onSubmit: (answer: string) => void;
  disabled?: boolean;
  roomCode?: string;
  suggestionsEnabled?: boolean;
  placeholder?: string;
};

export default function AnswerCombobox({
  onSubmit,
  disabled,
  roomCode,
  suggestionsEnabled = true,
  placeholder = "Type the manhwa title…",
}: Props) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<{ id: ReturnType<typeof setTimeout> | null }>({ id: null });
  const requestSeqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Auto-focus when mounted (new round)
  useEffect(() => {
    if (!disabled) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [disabled]);

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (!suggestionsEnabled) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      if (q.length < 1) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      const seq = ++requestSeqRef.current;
      setLoading(true);
      try {
        const list = await getSuggestions(q, roomCode);
        if (seq !== requestSeqRef.current) return;
        setSuggestions(list);
        setHighlight(0);
        setOpen(list.length > 0);
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    },
    [roomCode, suggestionsEnabled]
  );

  useEffect(() => {
    if (debounceRef.current.id) clearTimeout(debounceRef.current.id);
    debounceRef.current.id = setTimeout(() => fetchSuggestions(value), 50);
    return () => {
      if (debounceRef.current.id) clearTimeout(debounceRef.current.id);
    };
  }, [value, fetchSuggestions]);

  const submit = (v: string) => {
    if (!v.trim()) return;
    onSubmit(v.trim());
    setValue("");
    setSuggestions([]);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!open || !suggestions.length) {
      if (e.key === "Enter") { e.preventDefault(); submit(value); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % suggestions.length); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      const sel = suggestions[highlight];
      submit(sel ?? value);
    }
  };

  const handleSelect = (s: string) => submit(s);

  return (
    <div className="relative w-full animate-fade-in">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="suggestions-list"
          id="answer-input"
          className="w-full py-3.5 pl-4 pr-20 rounded-xl bg-white/5 border border-[var(--border-bright)] text-base placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--primary)] disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => submit(value)}
          disabled={disabled || !value.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-30 text-xs font-semibold"
        >
          {loading ? "…" : "Go"}
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id="suggestions-list"
          ref={listRef}
          role="listbox"
          className="absolute z-20 top-full left-0 right-0 mt-1.5 rounded-xl border border-[var(--border-bright)] bg-[var(--card-elevated)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden max-h-52 overflow-y-auto"
        >
          {suggestions.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === highlight}
              className={`px-4 py-2.5 text-sm cursor-pointer border-b border-[var(--border)] last:border-0 ${
                i === highlight
                  ? "bg-[var(--primary-dim)] text-white"
                  : "text-[var(--text)] hover:bg-white/5"
              }`}
              onMouseDown={() => handleSelect(s)}
            >
              {s}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-[var(--text-dim)]">
        {suggestionsEnabled
          ? "Start typing to see title suggestions — pick one or type your own."
          : "Suggestions off — type the title and press Go or Enter."}
      </p>
    </div>
  );
}
