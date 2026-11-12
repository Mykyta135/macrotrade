"use client";

import type { MlResult, RegimeData, GateDecision } from "../lib/types";

const GATE_STYLE: Record<GateDecision, { label: string; color: string; bg: string; border: string; glow: string }> = {
  HALT:     { label: "HALT",     color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.4)",   glow: "0 0 10px rgba(239,68,68,0.2)" },
  RESTRICT: { label: "RESTRICT", color: "#f97316", bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.4)",  glow: "0 0 10px rgba(249,115,22,0.15)" },
  SELECTIVE:{ label: "SELECT",   color: "#eab308", bg: "rgba(234,179,8,0.12)",   border: "rgba(234,179,8,0.4)",   glow: "" },
  NORMAL:   { label: "NORMAL",   color: "#10b981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.3)",  glow: "" },
  ALERT:    { label: "ALERT",    color: "#a855f7", bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.4)",  glow: "0 0 10px rgba(168,85,247,0.15)" },
};

const REGIME_COLOR: Record<string, string> = {
  trending: "#10b981",
  ranging:  "#3b82f6",
  volatile: "#f97316",
  crisis:   "#ef4444",
};

const MOMENTUM_ICON: Record<string, string> = {
  expanding:   "↑",
  contracting: "↓",
  flat:        "→",
};

const CLUSTER_DOT: Record<string, string> = {
  low:    "#10b981",
  medium: "#3b82f6",
  high:   "#f97316",
  crisis: "#ef4444",
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 flex-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[9px] num" style={{ color: "var(--text-muted)", minWidth: 22 }}>{pct}%</span>
    </div>
  );
}

function PairGateTile({
  ml,
  gate,
  selected,
  onClick,
}: {
  ml: MlResult;
  gate: GateDecision | undefined;
  selected: boolean;
  onClick: () => void;
}) {
  const g = gate ? GATE_STYLE[gate] : GATE_STYLE.NORMAL;
  const regimeColor = REGIME_COLOR[ml.knnRegime] ?? "#94a3b8";
  const momentumIcon = MOMENTUM_ICON[ml.volatilityMomentum] ?? "→";
  const clusterColor = CLUSTER_DOT[ml.volatilityCluster] ?? "#94a3b8";

  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all hover:brightness-110"
      style={{
        background: selected ? g.bg : "var(--bg-card)",
        borderColor: selected ? g.border : g.border,
        boxShadow: selected ? g.glow : undefined,
        minWidth: 120,
      }}
    >
      {/* Pair + Gate badge */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
          {ml.pair.replace("/", "")}
        </span>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: g.bg, color: g.color, border: `1px solid ${g.border}` }}
        >
          {g.label}
        </span>
      </div>

      {/* Regime + momentum */}
      <div className="flex items-center gap-1 text-[10px]">
        <span className="font-semibold" style={{ color: regimeColor }}>
          {ml.knnRegime.toUpperCase()}
        </span>
        <span style={{ color: ml.volatilityMomentum === "expanding" ? "#f97316" : ml.volatilityMomentum === "contracting" ? "#10b981" : "#94a3b8" }}>
          {momentumIcon}
        </span>
      </div>

      {/* Vol cluster dot + label */}
      <div className="flex items-center gap-1 text-[9px]" style={{ color: "var(--text-muted)" }}>
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: clusterColor }} />
        vol: {ml.volatilityCluster}
      </div>

      {/* KNN confidence bar */}
      <ConfidenceBar value={ml.knnConfidence} />
    </button>
  );
}

export function RegimeGatePanel({
  mlResults,
  regimes,
  selectedPair,
  onSelectPair,
}: {
  mlResults: MlResult[];
  regimes: RegimeData;
  selectedPair: string;
  onSelectPair: (pair: string) => void;
}) {
  const selected = mlResults.find((r) => r.pair === selectedPair);
  const regime = regimes[selectedPair];

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          ML Regime Gate — all pairs
        </span>
        {regime && (
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            KNN model · 94.7% acc · 13,544 pts
          </span>
        )}
      </div>

      {/* Pair tiles */}
      <div className="flex flex-wrap gap-2">
        {mlResults.map((ml) => (
          <PairGateTile
            key={ml.pair}
            ml={ml}
            gate={regimes[ml.pair]?.layer1RegimeGate?.gateDecision}
            selected={ml.pair === selectedPair}
            onClick={() => onSelectPair(ml.pair)}
          />
        ))}
      </div>

      {/* Selected pair detail strip */}
      {selected && regime && (
        <div
          className="rounded-lg border p-3 flex flex-col gap-2"
          style={{ background: "var(--bg-base)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Gate implication */}
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Gate</span>
              <span className="text-xs font-semibold" style={{ color: GATE_STYLE[regime.layer1RegimeGate.gateDecision].color }}>
                {regime.layer1RegimeGate.gateDecision} — {regime.layer1RegimeGate.gateImplication}
              </span>
            </div>

            {/* Metrics */}
            <div className="flex gap-4 text-[10px] shrink-0">
              <div className="flex flex-col items-center gap-0.5">
                <span style={{ color: "var(--text-muted)" }}>ATR ratio</span>
                <span className="num font-bold" style={{ color: selected.atrRatio > 1.5 ? "#f97316" : "var(--text-primary)" }}>
                  {selected.atrRatio.toFixed(2)}x
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span style={{ color: "var(--text-muted)" }}>Dir.Eff</span>
                <span className="num font-bold" style={{ color: selected.directionalEfficiency > 0.5 ? "#10b981" : "#94a3b8" }}>
                  {(selected.directionalEfficiency * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span style={{ color: "var(--text-muted)" }}>COT pct</span>
                <span className="num font-bold" style={{ color: selected.cotPercentile !== null && (selected.cotPercentile > 80 || selected.cotPercentile < 20) ? "#f59e0b" : "var(--text-primary)" }}>
                  {selected.cotPercentile !== null ? `${selected.cotPercentile}th` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Implication text */}
          <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {selected.implication}
          </p>

          {/* Conviction threshold */}
          {regime.convictionThreshold && (
            <div className="text-[10px] font-semibold px-2 py-1 rounded border inline-self-start self-start"
              style={{ color: "#fbbf24", borderColor: "rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.05)" }}>
              Conviction: {regime.convictionThreshold}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
