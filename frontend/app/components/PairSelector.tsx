"use client";

import { useState } from "react";
import type { RegimeData, ScoreData, TechnicalData } from "../lib/types";
import { DecisionMatrix } from "./DecisionMatrix";
import { ScoreCard } from "./ScoreCard";
import { TechnicalPanel } from "./TechnicalPanel";
import { SignalSummaryBanner, pairSignalColor } from "./SignalSummaryBanner";

const GRADE_ORDER = { A: 0, B: 1, C: 2, WATCH: 3, "NO TRADE": 4 };

export function PairSelector({
  data,
  regimes,
  technical,
}: {
  data: ScoreData;
  regimes: RegimeData | null;
  technical: TechnicalData | null;
}) {

  const sorted = [...data.pairs].sort(
    (a, b) => b.totalScore - a.totalScore || GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade],
  );
  const [selected, setSelected] = useState<string>(sorted[0]?.pair ?? "");
  const active = sorted.find((p) => p.pair === selected) ?? sorted[0];

  const activeRegime = regimes?.[selected] ?? null;
  const activeTechnical = technical?.[selected] ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Weekly profile banner */}
      {data.weeklyProfile && (
        <div
          className="rounded-lg border px-4 py-2.5 text-xs font-medium"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <span className="font-bold" style={{ color: "var(--text-primary)" }}>Weekly Profile: </span>
          {data.weeklyProfile}
        </div>
      )}

      {/* Danger zone global alert */}
      {data.dangerZoneActive && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/8 px-4 py-3 flex items-start gap-3 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
          <span className="text-xl">🚨</span>
          <p className="text-sm text-red-400 font-semibold">{data.dangerZoneMessage}</p>
        </div>
      )}

      {/* Top live setup banner */}
      {data.topSetup && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-start gap-3 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
          <span className="text-xl">🎯</span>
          <div>
            <p className="text-sm font-bold text-emerald-400">
              Live Setup — {data.topSetup.direction} {data.topSetup.pair} ({data.topSetup.totalScore}/5)
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {data.topSetup.tradeRecommendation}
            </p>
          </div>
        </div>
      )}

      {/* Top watchlist banner */}
      {data.topWatch && !data.topSetup && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
          <span className="text-xl">👁</span>
          <div>
            <p className="text-sm font-bold text-amber-400">
              Top Watchlist — {data.topWatch.pair} ({data.topWatch.totalScore}/5)
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {data.topWatch.watchlistReason}
            </p>
          </div>
        </div>
      )}

      {/* Pair tabs */}
      <div className="flex flex-wrap gap-2">
        {sorted.map((p) => {
          const isActive = p.pair === selected;
          const scoreColor =
            p.direction === "BUY" || p.direction === "SELL"
              ? p.totalScore >= 4 ? "text-emerald-400" : "text-blue-400"
              : p.direction === "WATCH"
              ? "text-amber-400"
              : "text-slate-500";

          const hasTrap = p.liquidityTrapWarning !== null;
          const pairRegime = regimes?.[p.pair];
          const gate = pairRegime?.layer1RegimeGate?.gateDecision;
          const gateColor =
            gate === "HALT"     ? "#ef4444" :
            gate === "RESTRICT" ? "#f97316" :
            gate === "SELECTIVE"? "#eab308" :
            gate === "ALERT"    ? "#a855f7" : undefined;

          const sigColor = pairSignalColor(p, regimes?.[p.pair], technical?.[p.pair]);

          return (
            <button
              key={p.pair}
              onClick={() => setSelected(p.pair)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all ${
                isActive
                  ? "border-blue-500/60 bg-blue-500/10 text-blue-300"
                  : "border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-200"
              }`}
              style={{ background: isActive ? undefined : "var(--bg-card)" }}
            >
              {/* Signal dot */}
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sigColor, boxShadow: `0 0 4px ${sigColor}` }} />
              <span>{p.pair}</span>
              <span className={`text-xs num font-bold ${scoreColor}`}>{p.totalScore}</span>
              {p.direction === "BUY" && <span className="text-[10px] text-emerald-400">BUY</span>}
              {p.direction === "SELL" && <span className="text-[10px] text-red-400">SELL</span>}
              {p.direction === "WATCH" && <span className="text-[10px] text-amber-400 tracking-wide">WATCH</span>}
              {hasTrap && <span className="text-[10px]" title="Liquidity Trap Detected">🧲</span>}
              {/* Gate badge on tab */}
              {gate && gate !== "NORMAL" && (
                <span className="text-[8px] font-bold px-1 rounded"
                  style={{ color: gateColor, background: `${gateColor}20`, border: `1px solid ${gateColor}40` }}>
                  {gate}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Signal summary banner */}
      {active && (
        <SignalSummaryBanner
          score={active}
          regime={activeRegime}
          tech={activeTechnical}
        />
      )}

      {/* Active pair scorecard */}
      {active && <ScoreCard score={active} />}

      {/* Decision Matrix (collapsible) */}
      {activeRegime && <DecisionMatrix regime={activeRegime} />}

      {/* Technical structure panel */}
      {activeTechnical && <TechnicalPanel data={activeTechnical} />}

      {/* Summary footer */}
      <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>
        {data.scorecardSummary}
      </p>
    </div>
  );
}
