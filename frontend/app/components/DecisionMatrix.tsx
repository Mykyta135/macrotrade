"use client";

import { useState } from "react";
import type { RegimePayload, ConflictFlag, GateDecision } from "../lib/types";

const GATE_COLOR: Record<GateDecision, string> = {
  HALT:     "#ef4444",
  RESTRICT: "#f97316",
  SELECTIVE:"#eab308",
  NORMAL:   "#10b981",
  ALERT:    "#a855f7",
};

function PassBadge({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
      style={{
        color: pass ? "#10b981" : "#ef4444",
        background: pass ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
        border: `1px solid ${pass ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
      }}>
      {pass ? `✓ ${label}` : `✗ ${label}`}
    </span>
  );
}

function SectionHeader({ title, pass, children }: { title: string; pass?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{title}</span>
      <div className="flex items-center gap-2">
        {children}
        {pass !== undefined && <PassBadge pass={pass} label={pass ? "PASS" : "FAIL"} />}
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: string }) {
  return (
    <div className="flex items-start justify-between gap-2 py-0.5 text-[10px]">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-right font-semibold" style={{ color: highlight ?? "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  const color = trend === "uptrend" ? "#10b981" : trend === "downtrend" ? "#ef4444" : "#94a3b8";
  const label = trend === "uptrend" ? "↑ UP" : trend === "downtrend" ? "↓ DOWN" : "→ CONS";
  return <span style={{ color }} className="font-bold">{label}</span>;
}

function Tier1({ tier }: { tier: RegimePayload["layer2Tier1Structural"] }) {
  return (
    <div className="flex flex-col gap-1">
      <SectionHeader title="Tier 1 — Structure" pass={tier.tier1Pass} />

      <div className="grid grid-cols-2 gap-x-4">
        <Row label="Weekly" value={<TrendBadge trend={tier.weeklyTrend} />} />
        <Row label="Daily"  value={<TrendBadge trend={tier.dailyTrend} />} />
        <Row label="H4"     value={<TrendBadge trend={tier.h4Trend} />} />
        <Row label="H1"     value={<TrendBadge trend={tier.h1Trend} />} />
      </div>

      <Row label="Alignment" value={`${tier.alignmentScore}/${tier.alignmentMax ?? 4}`}
        highlight={tier.alignmentScore >= 3 ? "#10b981" : tier.alignmentScore === 2 ? "#f59e0b" : "#ef4444"} />

      {tier.alignmentImplication && (
        <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{tier.alignmentImplication}</p>
      )}

      {tier.isBosConfirmed && (
        <Row label="BOS" value={`${tier.bosDirection}${tier.bosLevel ? ` @ ${tier.bosLevel.toFixed(4)}` : ""}`}
          highlight={tier.bosDirection === "bullish" ? "#10b981" : "#ef4444"} />
      )}

      {tier.isChochActive && tier.chochWarning && (
        <Row label="CHoCH" value={tier.chochWarning} highlight="#a855f7" />
      )}

      {/* Liquidity sweep — high conviction reversal signal */}
      {tier.liquiditySweep && (
        <div className="rounded border px-2 py-1 mt-0.5"
          style={{ borderColor: tier.liquiditySweep.direction === "bullish" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)", background: tier.liquiditySweep.direction === "bullish" ? "rgba(16,185,129,0.07)" : "rgba(239,68,68,0.07)" }}>
          <div className="text-[9px] font-bold mb-0.5" style={{ color: tier.liquiditySweep.direction === "bullish" ? "#10b981" : "#ef4444" }}>
            ⚡ LIQUIDITY SWEEP — {tier.liquiditySweep.direction === "bullish" ? "SSL Swept" : "BSL Swept"}
          </div>
          <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>
            Level {tier.liquiditySweep.level.toFixed(4)} · recovered in {tier.liquiditySweep.recoveryCandles}c · stop hunt complete
          </div>
        </div>
      )}

      {/* Liquidity flip — BOS level retested from correct side */}
      {tier.liquidityFlip?.isActive && (
        <div className="rounded border px-2 py-1 mt-0.5"
          style={{ borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.06)" }}>
          <div className="text-[9px] font-bold mb-0.5" style={{ color: "#fbbf24" }}>
            🔄 LIQUIDITY FLIP ACTIVE
          </div>
          <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>
            {tier.liquidityFlip.level.toFixed(4)} acting as {tier.liquidityFlip.direction === "bullish" ? "support" : "resistance"} · {tier.liquidityFlip.distancePct.toFixed(2)}% away
          </div>
        </div>
      )}

      {/* Stacked zones — A+ confluence */}
      {tier.stackedZones?.length > 0 && tier.stackedZones.map((z, i) => (
        <div key={i} className="rounded border px-2 py-1 mt-0.5"
          style={{ borderColor: z.score === 3 ? "rgba(168,85,247,0.5)" : "rgba(168,85,247,0.25)", background: "rgba(168,85,247,0.06)" }}>
          <div className="text-[9px] font-bold mb-0.5" style={{ color: "#a855f7" }}>
            {"★".repeat(z.score)} STACKED ZONE {z.score === 3 ? "(A+)" : ""} — {z.direction.toUpperCase()}
          </div>
          <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>
            {z.price.toFixed(4)} · {z.components.join(" + ")}
          </div>
        </div>
      ))}

      {/* Session BSL/SSL levels */}
      {(tier.nearestBSL || tier.nearestSSL) && (
        <div className="grid grid-cols-2 gap-x-4 mt-0.5">
          {tier.nearestBSL && (
            <Row label="BSL target ↑" value={`${tier.nearestBSL.toFixed(4)} (${tier.distanceToBSLPct?.toFixed(2)}%)`} highlight="#ef4444" />
          )}
          {tier.nearestSSL && (
            <Row label="SSL target ↓" value={`${tier.nearestSSL.toFixed(4)} (${tier.distanceToSSLPct?.toFixed(2)}%)`} highlight="#10b981" />
          )}
        </div>
      )}

      {/* Profile shape */}
      {tier.profileShape && tier.profileShape !== "normal" && tier.profileShape !== "unknown" && (
        <Row
          label="Profile"
          value={tier.profileShape === "b_shape" ? "b-shape: mean reversion UP" : "P-shape: mean reversion DOWN"}
          highlight={tier.profileShape === "b_shape" ? "#10b981" : "#ef4444"}
        />
      )}

      {/* LVN levels */}
      {tier.lvnLevels?.length > 0 && (
        <div className="flex gap-3">
          {tier.lvnLevels.map((l, i) => (
            <Row key={i} label={`LVN ${l.type}`} value={l.price.toFixed(4)} highlight="#f59e0b" />
          ))}
        </div>
      )}

      {tier.priceInsideDemand && (
        <Row label="Price" value="Inside Demand Zone" highlight="#10b981" />
      )}
      {tier.priceInsideSupply && (
        <Row label="Price" value="Inside Supply Zone" highlight="#ef4444" />
      )}

      {tier.openImbalance && (
        <Row label="Imbalance" value={`${tier.openImbalance.direction} ${tier.openImbalance.bottom.toFixed(4)}–${tier.openImbalance.top.toFixed(4)}`}
          highlight="#f59e0b" />
      )}

      <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {tier.tier1Implication}
      </p>
    </div>
  );
}

function Tier2({ tier }: { tier: RegimePayload["layer2Tier2Fundamental"] }) {
  const oiColor = tier.cotOiDivergence === "bullish_exhaustion" ? "#ef4444"
    : tier.cotOiDivergence === "bearish_exhaustion" ? "#10b981" : "var(--text-muted)";
  const liquidationColor = tier.cotLiquidationRisk === "high" ? "#ef4444"
    : tier.cotLiquidationRisk === "moderate" ? "#f59e0b" : "#94a3b8";

  return (
    <div className="flex flex-col gap-1">
      <SectionHeader title="Tier 2 — Fundamentals" pass={tier.tier2Pass} />

      {tier.cbDivergenceDirection && (
        <Row label="CB Divergence" value={tier.cbDivergenceDirection}
          highlight={tier.cbAlignsWithSystemSignal ? "#10b981" : "#f97316"} />
      )}
      {tier.timeDecayWarning && (
        <Row label="Time Decay" value="CB divergence 3+ weeks unconfirmed — Tier 1 overrides" highlight="#f59e0b" />
      )}
      <Row label="Real Yields" value={tier.realYieldTrend} />
      <Row label="Liquidity" value={tier.liquidityRegime}
        highlight={tier.liquidityRegime === "expanding" ? "#10b981" : tier.liquidityRegime === "contracting" ? "#ef4444" : "#94a3b8"} />

      {/* COT deep signals */}
      {tier.cotPercentile !== null && (
        <Row label="COT" value={`${tier.cotPercentile}th pct`}
          highlight={tier.cotPercentile > 80 || tier.cotPercentile < 20 ? "#f59e0b" : "var(--text-primary)"} />
      )}
      {tier.cotVelocity3w !== null && Math.abs(tier.cotVelocity3w) > 10000 && (
        <Row label="COT Velocity" value={`${tier.cotVelocity3w > 0 ? "+" : ""}${new Intl.NumberFormat("en-US").format(tier.cotVelocity3w)} (3w)`}
          highlight={Math.abs(tier.cotVelocity3w) > 30000 ? "#ef4444" : "#f59e0b"} />
      )}
      {tier.cotOiDivergence && tier.cotOiDivergence !== "none" && (
        <Row label="OI Divergence"
          value={tier.cotOiDivergence === "bullish_exhaustion" ? "Bullish exhaustion — rally on fumes" : "Short-squeeze building"}
          highlight={oiColor} />
      )}
      {tier.cotLiquidationRisk && tier.cotLiquidationRisk !== "low" && (
        <Row label="Cascade Risk" value={tier.cotLiquidationRisk.toUpperCase()} highlight={liquidationColor} />
      )}

      <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {tier.tier2Implication}
      </p>
    </div>
  );
}

function Tier3({ tier }: { tier: RegimePayload["layer2Tier3Contextual"] }) {
  return (
    <div className="flex flex-col gap-1">
      <SectionHeader title="Tier 3 — Context" />

      <Row label="Session" value={tier.session.replace(/_/g, " ").toUpperCase()} />
      {tier.eoqFlowActive && (
        <Row label="EOQ Flow" value="ACTIVE — watch rebalancing" highlight="#f59e0b" />
      )}
      {tier.eoqDaysUntil !== null && !tier.eoqFlowActive && (
        <Row label="EOQ in" value={`${tier.eoqDaysUntil} days`} />
      )}
      {tier.adrExhaustionPct !== null && (
        <Row
          label="ADR Used"
          value={`${tier.adrExhaustionPct}%`}
          highlight={tier.adrExhausted ? "#ef4444" : tier.adrExhaustionPct > 60 ? "#f59e0b" : "var(--text-primary)"}
        />
      )}
      {tier.adrExhausted && (
        <Row label="ADR Status" value="EXHAUSTED — await next session" highlight="#ef4444" />
      )}
      {tier.retailLongPct !== null && (
        <Row label="Retail Long" value={`${tier.retailLongPct}%`}
          highlight={tier.retailLongPct > 70 || tier.retailLongPct < 30 ? "#f59e0b" : "var(--text-primary)"} />
      )}
      {tier.retailSignal && (
        <Row label="Retail Signal" value={tier.retailSignal} />
      )}

      {/* CME Futures Quality — the DIX equivalent for FX */}
      {tier.futuresConfirmation && tier.futuresConfirmation.quality !== "neutral" && (() => {
        const fc = tier.futuresConfirmation!;
        const qualityColor = fc.quality === "institutional" ? "#10b981"
          : fc.quality === "covering_only" ? "#f59e0b"
          : "#ef4444"; // liquidation_only
        const qualityLabel = fc.quality === "institutional" ? "INSTITUTIONAL"
          : fc.quality === "covering_only" ? "COVERING ONLY"
          : "LIQUIDATION ONLY";
        return (
          <div className="flex flex-col gap-1 mt-1">
            <div className="rounded border px-2 py-1.5"
              style={{ borderColor: `${qualityColor}40`, background: `${qualityColor}08` }}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-bold uppercase" style={{ color: qualityColor }}>
                  CME Futures: {qualityLabel}
                </span>
                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                  OI {fc.oiChangePct >= 0 ? "+" : ""}{fc.oiChangePct.toFixed(1)}%
                </span>
              </div>
              <div className="flex gap-3 text-[9px]" style={{ color: "var(--text-muted)" }}>
                {fc.newLongsAdded !== 0 && (
                  <span style={{ color: fc.newLongsAdded > 0 ? "#10b981" : "#ef4444" }}>
                    Longs {fc.newLongsAdded > 0 ? "+" : ""}{new Intl.NumberFormat("en-US").format(fc.newLongsAdded)}
                  </span>
                )}
                {fc.newShortsAdded !== 0 && (
                  <span style={{ color: fc.newShortsAdded > 0 ? "#ef4444" : "#10b981" }}>
                    Shorts {fc.newShortsAdded > 0 ? "+" : ""}{new Intl.NumberFormat("en-US").format(fc.newShortsAdded)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {tier.tier3Implication}
      </p>
    </div>
  );
}

function ConflictBlock({ flags }: { flags: ConflictFlag[] }) {
  if (flags.length === 0) return (
    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>No active conflicts detected.</div>
  );

  return (
    <div className="flex flex-col gap-2">
      {flags.map((f) => (
        <div key={f.conflictId} className="rounded-lg border px-3 py-2 flex flex-col gap-1"
          style={{ borderColor: "rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.05)" }}>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold px-1 rounded" style={{ color: "#a855f7", background: "rgba(168,85,247,0.15)" }}>
              {f.conflictId}
            </span>
            <span className="text-[10px] font-semibold" style={{ color: "#c084fc" }}>{f.description}</span>
          </div>
          <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            → {f.resolution}
          </p>
        </div>
      ))}
    </div>
  );
}

export function DecisionMatrix({ regime }: { regime: RegimePayload }) {
  const [open, setOpen] = useState(false);
  const gate = regime.layer1RegimeGate;
  const gateColor = GATE_COLOR[gate.gateDecision];

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:brightness-110 transition-all"
        style={{ background: "var(--bg-card)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
            Decision Matrix — {regime.pair}
          </span>

          {/* Gate pill */}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded border"
            style={{ color: gateColor, borderColor: `${gateColor}40`, background: `${gateColor}14` }}>
            {gate.gateDecision}
          </span>

          {/* Tier pass pills */}
          <PassBadge pass={regime.layer2Tier1Structural.tier1Pass} label="T1" />
          <PassBadge pass={regime.layer2Tier2Fundamental.tier2Pass} label="T2" />

          {/* Conflict count */}
          {regime.conflictFlags.length > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ color: "#a855f7", background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)" }}>
              {regime.conflictFlags.length} conflict{regime.conflictFlags.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4" style={{ borderTop: "1px solid var(--border)" }}>

          {/* Layer 1 — Gate */}
          <div className="pt-3 flex flex-col gap-1">
            <SectionHeader title="Layer 1 — Regime Gate">
              <span className="text-[10px] font-bold" style={{ color: gateColor }}>
                {gate.gateDecision}
              </span>
            </SectionHeader>
            <div className="grid grid-cols-2 gap-x-4">
              <Row label="Vol State" value={gate.volatilityState.toUpperCase()} />
              <Row label="Vol Momentum" value={gate.volatilityMomentum.toUpperCase()} />
              <Row label="KNN Confidence" value={`${(gate.knnConfidence * 100).toFixed(0)}%`}
                highlight={gate.knnConfidence > 0.7 ? "#10b981" : "#f59e0b"} />
              <Row label="ATR Ratio" value={`${gate.atrRatio.toFixed(2)}x`}
                highlight={gate.atrRatio > 1.5 ? "#f97316" : "var(--text-primary)"} />
            </div>
            <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {gate.gateImplication}
            </p>
            <div className="mt-1 text-[10px] font-semibold px-2 py-1 rounded border self-start"
              style={{ color: "#fbbf24", borderColor: "rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.05)" }}>
              Conviction required: {regime.convictionThreshold}
            </div>
          </div>

          <div className="h-px" style={{ background: "var(--border)" }} />

          {/* Tier 1 */}
          <Tier1 tier={regime.layer2Tier1Structural} />

          <div className="h-px" style={{ background: "var(--border)" }} />

          {/* Tier 2 */}
          <Tier2 tier={regime.layer2Tier2Fundamental} />

          <div className="h-px" style={{ background: "var(--border)" }} />

          {/* Tier 3 */}
          <Tier3 tier={regime.layer2Tier3Contextual} />

          <div className="h-px" style={{ background: "var(--border)" }} />

          {/* Conflicts */}
          <div>
            <SectionHeader title={`Conflict Flags (${regime.conflictFlags.length})`} />
            <ConflictBlock flags={regime.conflictFlags} />
          </div>
        </div>
      )}
    </div>
  );
}
