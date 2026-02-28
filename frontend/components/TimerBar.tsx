"use client";

export default function TimerBar({
  secondsLeft,
  maxSeconds = 20,
}: {
  secondsLeft: number | null;
  maxSeconds?: number;
}) {
  const value = secondsLeft ?? 0;
  const pct = maxSeconds > 0 ? Math.max(0, Math.min(100, (value / maxSeconds) * 100)) : 0;

  const isLow = value <= Math.round(maxSeconds * 0.25);
  const isMid = value <= Math.round(maxSeconds * 0.5) && !isLow;

  const barColor = isLow
    ? "#ef4444"
    : isMid
    ? "#f59e0b"
    : "#6366f1";

  return (
    <div className="w-full" role="timer" aria-live="polite" aria-atomic="true">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Time</span>
        <span
          className={`text-sm font-mono font-semibold tabular-nums ${
            isLow
              ? "text-[var(--error)] animate-timer-pulse"
              : isMid
              ? "text-[var(--warning)]"
              : "text-[var(--text)]"
          }`}
        >
          {value > 0 ? `${value}s` : "Time's up"}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}
