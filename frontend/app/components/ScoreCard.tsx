import type { PairScore, ScoreFactor, KillSwitch } from "../lib/types";
import { Card, CardTitle } from "./Card";

function statusIcon(status: ScoreFactor["status"]) {
  if (status === "pass") return <span className="text-emerald-400 font-bold">✓</span>;
  if (status === "warn") return <span className="text-amber-400 font-bold">⚠</span>;
  return <span className="text-red-400 font-bold">✗</span>;
}

function directionStyle(dir: PairScore["direction"]) {
  if (dir === "BUY")     return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.1)]";
  if (dir === "SELL")    return "text-red-400 border-red-500/40 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.1)]";
  if (dir === "WATCH")   return "text-amber-400 border-amber-500/40 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.1)]";
  return "text-slate-400 border-slate-600/40 bg-slate-700/10";
}

function gradeColor(grade: PairScore["grade"]) {
  if (grade === "A")     return "text-emerald-400";
  if (grade === "B")     return "text-blue-400";
  if (grade === "C")     return "text-amber-400";
  if (grade === "WATCH") return "text-amber-400";
  return "text-slate-500";
}

function ScoreRing({ score, max, dir }: { score: number; max: number; dir: PairScore["direction"] }) {
  const pct = (score / max) * 100;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color =
    dir === "NO TRADE" ? "#64748b" :
    dir === "WATCH"    ? "#f59e0b" :
    pct >= 80          ? "#10b981" :
    pct >= 60          ? "#3b82f6" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="72" height="72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-lg font-bold num" style={{ color }}>{score}</span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>/{max}</span>
      </div>
    </div>
  );
}

function KillSwitchRow({ ks }: { ks: KillSwitch }) {
  return (
    <div className="flex items-start gap-2 text-xs py-1">
      <div className="w-4 shrink-0 pt-0.5">
        {ks.passed
          ? <span className="text-emerald-400 font-bold">✓</span>
          : <span className="text-red-400 font-bold">✗</span>}
      </div>
      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
        <span className="font-semibold" style={{ color: ks.passed ? "var(--text-primary)" : "#f87171" }}>
          {ks.name}
        </span>
        <span style={{ color: "var(--text-muted)" }}>{ks.detail}</span>
        
        {/* Оновлений UI для Тригера (Unlock Condition) */}
        {!ks.passed && ks.unlockCondition && (
          <div className="mt-1.5 flex items-start gap-1.5 p-2 rounded border" style={{ background: "rgba(245,158,11,0.05)", borderColor: "rgba(245,158,11,0.2)" }}>
            <span className="text-[10px] mt-0.5">🎯</span>
            <span className="text-[11px] leading-snug" style={{ color: "#fbbf24" }}>
              <strong className="uppercase tracking-wider text-[9px] mr-1 opacity-80">Trigger:</strong>
              {ks.unlockCondition}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ScoreCard({ score }: { score: PairScore }) {
  const isLive = score.direction === "BUY" || score.direction === "SELL";
  const isWatch = score.direction === "WATCH";

  return (
    <Card className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight">{score.pair}</span>
            <span className={`text-lg font-bold ${gradeColor(score.grade)}`}>{score.grade}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`inline-flex items-center px-3 py-1 rounded border text-sm font-bold tracking-wide ${directionStyle(score.direction)}`}>
              {score.direction}
            </div>
            {score.systemBias && !isLive && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-bold"
                style={{
                  color: score.systemBias === "BUY" ? "#10b981" : "#ef4444",
                  borderColor: score.systemBias === "BUY" ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)",
                  background: score.systemBias === "BUY" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                }}>
                BIAS {score.systemBias === "BUY" ? "↑" : "↓"} {score.systemBias}
              </div>
            )}
          </div>
        </div>
        <ScoreRing score={score.totalScore} max={score.maxScore} dir={score.direction} />
      </div>

      {/* НОВИЙ БЛОК: Trade Narrative */}
      <div className="flex flex-col gap-2">
        <CardTitle>Trade Narrative</CardTitle>
        <div className="flex flex-col gap-2">
          
          {/* Recommendation Base */}
          <div
            className="text-xs leading-relaxed rounded-lg px-3 py-2.5 border"
            style={{
              background: isWatch ? "rgba(245,158,11,0.03)" : isLive ? "rgba(16,185,129,0.03)" : "var(--bg-card-2)",
              borderColor: isWatch ? "rgba(245,158,11,0.3)" : isLive ? "rgba(16,185,129,0.3)" : "var(--border)",
              color: isWatch ? "#fcd34d" : "var(--text-primary)",
            }}
          >
            {score.tradeRecommendation}
          </div>

          {/* R2 Inversion Warning (The Lie Detector) */}
          {score.r2InversionNote && (
            <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2.5 flex gap-2 items-start shadow-[0_0_10px_rgba(59,130,246,0.1)]">
              <span className="text-sm mt-0.5">🔍</span>
              <div>
                <p className="text-[10px] font-bold text-blue-400 mb-0.5 uppercase tracking-wider">R2 Lie Detector</p>
                <p className="text-xs leading-relaxed font-medium text-blue-200">
                  {score.r2InversionNote}
                </p>
              </div>
            </div>
          )}

          {/* Watchlist Focus (If in WATCH mode) */}
          {isWatch && score.watchlistReason && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 flex gap-2 items-start">
              <span className="text-sm mt-0.5">👁</span>
              <div>
                <p className="text-[10px] font-bold text-amber-500 mb-0.5 uppercase tracking-wider">Waiting For</p>
                <p className="text-xs leading-relaxed font-medium" style={{ color: "#fbbf24" }}>{score.watchlistReason}</p>
              </div>
            </div>
          )}

          {/* Liquidity Trap Warning (The Magnet) */}
          {score.liquidityTrapWarning && (
            <div className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-2.5 flex gap-2 items-start shadow-[0_0_10px_rgba(168,85,247,0.1)]">
              <span className="text-sm mt-0.5">🧲</span>
              <div>
                <p className="text-[10px] font-bold text-purple-400 mb-0.5 uppercase tracking-wider">Liquidity Trap Detected</p>
                <p className="text-xs leading-relaxed font-medium text-purple-200">
                  {score.liquidityTrapWarning}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full h-px" style={{ background: "var(--border)" }} />

      {/* Step 1: Kill Switches */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 mb-0.5">
          <CardTitle>Step 1 — Kill Switches</CardTitle>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border" style={{
            background: score.killSwitchBlocked ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
            borderColor: score.killSwitchBlocked ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)",
            color: score.killSwitchBlocked ? "#f87171" : "#34d399",
          }}>
            {score.killSwitchBlocked ? "BLOCKED" : "ALL CLEAR"}
          </span>
        </div>
        {score.killSwitches.map((ks, i) => (
          <KillSwitchRow key={i} ks={ks} />
        ))}
      </div>

      <div className="w-full h-px" style={{ background: "var(--border)" }} />

      {/* Step 2: Point System */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 mb-0.5">
          <CardTitle>Step 2 — Confluence (need ≥3/5)</CardTitle>
        </div>
        {score.factors.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Scoring skipped — pair halted by R4 veto (news/panic event).
          </p>
        ) : score.factors.map((f, i) => (
          <div key={i} className="flex items-start gap-2 text-xs py-1">
            <div className="w-4 shrink-0 pt-0.5">{statusIcon(f.status)}</div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{f.name}</span>
                <span
                  className="shrink-0 num font-bold text-[11px] px-1.5 py-0.5 rounded border"
                  style={{
                    background: f.score === f.maxScore ? "rgba(16,185,129,0.1)" : f.score > 0 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
                    borderColor: f.score === f.maxScore ? "rgba(16,185,129,0.3)" : f.score > 0 ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)",
                    color: f.score === f.maxScore ? "#34d399" : f.score > 0 ? "#fbbf24" : "#f87171",
                  }}
                >
                  {f.score}/{f.maxScore} pts
                </span>
              </div>
              <span className="leading-relaxed mt-1" style={{ color: "var(--text-muted)" }}>{f.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}