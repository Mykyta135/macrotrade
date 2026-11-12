"use client";
import type { JournalStats } from "../../lib/types";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "NZD/USD", "USD/CAD", "USD/CHF", "GBP/JPY"];
const GRADES = ["A", "B", "C", "WATCH", "NO TRADE"];

function StatBox({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: "var(--bg-card-2)", border: "1px solid var(--border)" }}>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-2xl font-bold num" style={{ color: color ?? "var(--text-primary)" }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{sub}</span>}
    </div>
  );
}

function WinBar({ label, wins, total, pips }: { label: string; wins: number; total: number; pips?: number }) {
  const pct = total > 0 ? Math.round((wins / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-20 shrink-0 font-mono" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 60 ? "var(--green)" : pct >= 45 ? "var(--yellow)" : "var(--red)" }} />
      </div>
      <span className="text-xs num w-12 text-right" style={{ color: "var(--text-secondary)" }}>{pct}%</span>
      <span className="text-xs num w-10 text-right" style={{ color: "var(--text-muted)" }}>{total}T</span>
      {pips !== undefined && (
        <span className="text-xs num w-16 text-right" style={{ color: pips >= 0 ? "var(--green)" : "var(--red)" }}>
          {pips >= 0 ? "+" : ""}{pips}p
        </span>
      )}
    </div>
  );
}

function MiniEquityCurve({ data }: { data: Array<{ pnlPips: number; outcome: string }> }) {
  if (data.length === 0) return null;
  let running = 0;
  const points = data.map(d => { running += d.pnlPips; return running; });
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const range = max - min || 1;
  const W = 280, H = 60;
  const xs = points.map((_, i) => (i / Math.max(points.length - 1, 1)) * W);
  const ys = points.map(p => H - ((p - min) / range) * H);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const final = points[points.length - 1];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Equity Curve (last {data.length} trades)</span>
        <span className="text-sm font-bold num" style={{ color: final >= 0 ? "var(--green)" : "var(--red)" }}>
          {final >= 0 ? "+" : ""}{final.toFixed(0)} pips
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        <line x1="0" y1={H - ((-min) / range) * H} x2={W} y2={H - ((-min) / range) * H}
          stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4,4" />
        <path d={d} fill="none" stroke={final >= 0 ? "var(--green)" : "var(--red)"} strokeWidth="1.5" />
        {points.map((p, i) => (
          <circle key={i} cx={xs[i]} cy={ys[i]} r="2"
            fill={data[i].outcome === "WIN" ? "var(--green)" : data[i].outcome === "LOSS" ? "var(--red)" : "var(--yellow)"} />
        ))}
      </svg>
    </div>
  );
}

export function StatsPanel({ stats }: { stats: JournalStats }) {
  const emotionLabel = (r: number) =>
    r >= 4.5 ? "Calm & Disciplined" : r >= 3.5 ? "Mostly Controlled" : r >= 2.5 ? "Mixed" : r >= 1.5 ? "Anxious" : "Fear/FOMO";

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatBox label="Win Rate" value={`${stats.winRate}%`}
          color={stats.winRate >= 60 ? "var(--green)" : stats.winRate >= 45 ? "var(--yellow)" : "var(--red)"}
          sub={`${stats.closedTrades} closed`} />
        <StatBox label="Profit Factor" value={stats.profitFactor}
          color={stats.profitFactor >= 1.5 ? "var(--green)" : stats.profitFactor >= 1 ? "var(--yellow)" : "var(--red)"}
          sub="wins÷losses pips" />
        <StatBox label="Avg R:R" value={stats.avgRR}
          color={stats.avgRR >= 2 ? "var(--green)" : stats.avgRR >= 1.5 ? "var(--yellow)" : "var(--text-primary)"}
          sub="per closed trade" />
        <StatBox label="Total Pips" value={`${stats.totalPnlPips >= 0 ? "+" : ""}${stats.totalPnlPips}`}
          color={stats.totalPnlPips >= 0 ? "var(--green)" : "var(--red)"}
          sub={`avg ${stats.avgPnlPips >= 0 ? "+" : ""}${stats.avgPnlPips}p`} />
        <StatBox label="Open Trades" value={stats.openTrades} sub="active" />
        <StatBox label="Win Streak" value={stats.longestWinStreak}
          color={stats.longestWinStreak >= 5 ? "var(--green)" : "var(--text-primary)"}
          sub="longest" />
        <StatBox label="Loss Streak" value={stats.longestLossStreak}
          color={stats.longestLossStreak >= 4 ? "var(--red)" : "var(--text-primary)"}
          sub="longest" />
        <StatBox label="Emotion" value={stats.avgEmotionRating > 0 ? stats.avgEmotionRating.toFixed(1) : "—"}
          color={stats.avgEmotionRating >= 4 ? "var(--green)" : stats.avgEmotionRating >= 3 ? "var(--yellow)" : stats.avgEmotionRating > 0 ? "var(--red)" : "var(--text-muted)"}
          sub={stats.avgEmotionRating > 0 ? emotionLabel(stats.avgEmotionRating) : "not tracked"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equity curve */}
        <div className="lg:col-span-1 rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <MiniEquityCurve data={stats.recentPerformance} />
          {stats.recentPerformance.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>No closed trades yet</p>
          )}
        </div>

        {/* System discipline */}
        <div className="rounded-xl p-4 flex flex-col gap-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>System Discipline</span>
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Followed system</span>
                <span className="text-xs font-bold num" style={{ color: "var(--green)" }}>{stats.followedSystemWinRate}% WR</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full" style={{ width: `${stats.followedSystemWinRate}%`, background: "var(--green)" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Overrode signal</span>
                <span className="text-xs font-bold num" style={{ color: stats.overrodeSystemWinRate < stats.followedSystemWinRate ? "var(--red)" : "var(--yellow)" }}>
                  {stats.overrodeSystemWinRate}% WR
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full" style={{
                  width: `${stats.overrodeSystemWinRate}%`,
                  background: stats.overrodeSystemWinRate < stats.followedSystemWinRate ? "var(--red)" : "var(--yellow)"
                }} />
              </div>
            </div>
          </div>
          {stats.followedSystemWinRate > 0 && stats.overrodeSystemWinRate > 0 && (
            <p className="text-xs mt-1 p-2 rounded" style={{
              background: stats.followedSystemWinRate > stats.overrodeSystemWinRate ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
              color: stats.followedSystemWinRate > stats.overrodeSystemWinRate ? "var(--green)" : "var(--red)",
              border: `1px solid ${stats.followedSystemWinRate > stats.overrodeSystemWinRate ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`
            }}>
              {stats.followedSystemWinRate > stats.overrodeSystemWinRate
                ? `System beats discretion by ${stats.followedSystemWinRate - stats.overrodeSystemWinRate}pp — trust the process`
                : `Discretion beats system by ${stats.overrodeSystemWinRate - stats.followedSystemWinRate}pp — review override logic`}
            </p>
          )}
          <div className="mt-auto pt-2 flex gap-4 text-xs num" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
            {Object.entries(stats.byOutcome).map(([k, v]) => (
              <span key={k}><span style={{ color: k === "WIN" ? "var(--green)" : k === "LOSS" ? "var(--red)" : "var(--yellow)" }}>{k}</span> {v}</span>
            ))}
          </div>
        </div>

        {/* Grade breakdown */}
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Win Rate by System Grade</span>
          {GRADES.map(g => {
            const d = stats.byGrade[g];
            if (!d || d.trades === 0) return null;
            return <WinBar key={g} label={`Grade ${g}`} wins={d.wins} total={d.trades} />;
          })}
          {Object.keys(stats.byGrade).length === 0 && (
            <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>No data yet</p>
          )}
        </div>
      </div>

      {/* Per-pair breakdown */}
      <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wide block mb-3" style={{ color: "var(--text-muted)" }}>Performance by Pair</span>
        <div className="flex flex-col gap-2">
          {PAIRS.map(p => {
            const d = stats.byPair[p];
            if (!d || d.trades === 0) return null;
            return <WinBar key={p} label={p} wins={d.wins} total={d.trades} pips={d.totalPips} />;
          })}
          {Object.keys(stats.byPair).length === 0 && (
            <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>No closed trades yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
