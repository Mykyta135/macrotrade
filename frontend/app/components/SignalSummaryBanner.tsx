"use client";

import type { PairScore, RegimePayload, TechnicalContext } from "../lib/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function pill(text: string, color: string) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide shrink-0"
      style={{ color, background: `${color}1a`, border: `1px solid ${color}40` }}
    >
      {text}
    </span>
  );
}

type SignalItem = { label: string; color: string; icon: string };

// ─── signal extraction ──────────────────────────────────────────────────────

function extractTechSignals(tech: TechnicalContext, dir: string): SignalItem[] {
  const signals: SignalItem[] = [];
  const isBuy = dir === "BUY";
  const isSell = dir === "SELL";

  // Donchian breakout — primary confirmation
  for (const [tf, label] of [["daily", "Daily"], ["h4", "H4"], ["weekly", "Weekly"]] as const) {
    const d = tech.timeframes[tf]?.donchian;
    if (!d || d.breakout === "none") continue;
    const breakoutBuy = d.breakout === "bullish";
    if ((isBuy && breakoutBuy) || (isSell && !breakoutBuy)) {
      signals.push({ label: `${label} Donchian ${d.breakoutStrength === "strong" ? "STRONG" : ""} breakout`, color: isBuy ? "#10b981" : "#ef4444", icon: "📈" });
    } else {
      signals.push({ label: `${label} Donchian COUNTER-breakout`, color: "#f97316", icon: "⚠" });
    }
    break;
  }

  // RSI divergence — confirmation / warning
  for (const [tf, label] of [["daily", "Daily"], ["h4", "H4"], ["weekly", "Weekly"]] as const) {
    const r = tech.timeframes[tf]?.rsi;
    if (!r || r.divergence === "none") continue;
    const divBull = r.divergence === "bullish";
    const color = (isBuy && divBull) || (isSell && !divBull) ? "#10b981" : "#f97316";
    const str = r.divergenceStrength === "strong" ? "STRONG " : "";
    signals.push({ label: `${label} RSI ${str}${r.divergence} divergence`, color, icon: "〰" });
    break;
  }

  // Bollinger squeeze/walk
  for (const [tf, label] of [["daily", "Daily"], ["h4", "H4"]] as const) {
    const b = tech.timeframes[tf]?.bollinger;
    if (!b) continue;
    if (b.squeeze) {
      signals.push({ label: `${label} BB squeeze — await breakout`, color: "#a855f7", icon: "🗜" });
      break;
    }
    if (b.walkingUpperBand && isBuy) {
      signals.push({ label: `${label} BB band walk UP`, color: "#10b981", icon: "🚀" });
      break;
    }
    if (b.walkingLowerBand && isSell) {
      signals.push({ label: `${label} BB band walk DOWN`, color: "#ef4444", icon: "🚀" });
      break;
    }
  }

  // Stacked zone
  if (tech.stackedZones?.length > 0) {
    const z = tech.stackedZones[0];
    const zBuy = z.direction === "demand";
    if ((isBuy && zBuy) || (isSell && !zBuy)) {
      signals.push({ label: `${z.score === 3 ? "A+" : "★"} Stacked ${z.direction} zone @ ${z.price.toFixed(4)}`, color: "#a855f7", icon: "★" });
    }
  }

  // Liquidity sweep
  const daily = tech.timeframes.daily;
  if (daily?.liquiditySweep) {
    const ls = daily.liquiditySweep;
    if ((isBuy && ls.direction === "bullish") || (isSell && ls.direction === "bearish")) {
      signals.push({ label: `Daily liquidity sweep (${ls.direction})`, color: "#fbbf24", icon: "⚡" });
    }
  }

  return signals;
}

// ─── verdict synthesis ──────────────────────────────────────────────────────

type Verdict = "CONFIRMED" | "WATCH" | "BLOCKED" | "NO SIGNAL";

function computeVerdict(
  score: PairScore,
  regime: RegimePayload | null,
  techSignals: SignalItem[],
): { verdict: Verdict; reason: string; color: string; bg: string; border: string } {
  const dir = score.direction;
  const gate = regime?.layer1RegimeGate?.gateDecision;
  const t1 = regime?.layer2Tier1Structural?.tier1Pass;
  const t2 = regime?.layer2Tier2Fundamental?.tier2Pass;

  if (dir === "NO TRADE") {
    const bias = score.systemBias;
    const biasStr = bias ? ` — system leans ${bias}` : "";
    const color = bias === "BUY" ? "#10b981" : bias === "SELL" ? "#ef4444" : "#64748b";
    const bg    = bias === "BUY" ? "rgba(16,185,129,0.06)" : bias === "SELL" ? "rgba(239,68,68,0.06)" : "rgba(100,116,139,0.06)";
    const border = bias === "BUY" ? "rgba(16,185,129,0.2)" : bias === "SELL" ? "rgba(239,68,68,0.2)" : "rgba(100,116,139,0.2)";
    return { verdict: "NO SIGNAL", reason: `Score below threshold${biasStr}`, color, bg, border };
  }

  if (score.killSwitchBlocked) {
    const blocked = score.killSwitches.filter(ks => !ks.passed).map(ks => ks.name).join(", ");
    return { verdict: "BLOCKED", reason: `Kill switch failed: ${blocked}`, color: "#ef4444", bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.25)" };
  }

  if (gate === "HALT") {
    return { verdict: "BLOCKED", reason: "Regime gate: HALT — extreme volatility, no trades", color: "#ef4444", bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.25)" };
  }

  if (dir === "WATCH") {
    return { verdict: "WATCH", reason: score.watchlistReason ?? "Monitoring for entry trigger", color: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.25)" };
  }

  // Live signal: BUY or SELL
  const gradeA = score.grade === "A";
  const t1Ok = t1 !== false;
  const t2Ok = t2 !== false;
  const hasTechConfirm = techSignals.some(s => s.color === "#10b981");
  const gateOk = !gate || gate === "NORMAL" || gate === "SELECTIVE" || gate === "ALERT";

  if (gradeA && t1Ok && t2Ok && hasTechConfirm && gateOk) {
    return { verdict: "CONFIRMED", reason: `Grade ${score.grade}, T1 ${t1 ? "✓" : "✗"}, T2 ${t2 ? "✓" : "✗"}, Gate ${gate ?? "NORMAL"}`, color: "#10b981", bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.25)" };
  }

  const warnings: string[] = [];
  if (!gradeA) warnings.push(`Grade ${score.grade}`);
  if (!t1Ok) warnings.push("T1 fail");
  if (!t2Ok) warnings.push("T2 fail");
  if (!hasTechConfirm) warnings.push("no tech confirmation");
  if (gate && gate !== "NORMAL") warnings.push(`Gate ${gate}`);

  return { verdict: "WATCH", reason: warnings.length ? `Partial signal — ${warnings.join(", ")}` : "Signal forming", color: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.25)" };
}

// ─── step chain ─────────────────────────────────────────────────────────────

function StepChain({ score, regime }: { score: PairScore; regime: RegimePayload | null }) {
  const gate = regime?.layer1RegimeGate?.gateDecision ?? "NORMAL";
  const t1 = regime?.layer2Tier1Structural?.tier1Pass;
  const t2 = regime?.layer2Tier2Fundamental?.tier2Pass;
  const alignScore = regime?.layer2Tier1Structural?.alignmentScore ?? null;
  const alignMax = regime?.layer2Tier1Structural?.alignmentMax ?? 4;

  const GATE_COLOR: Record<string, string> = {
    HALT: "#ef4444", RESTRICT: "#f97316", SELECTIVE: "#eab308", ALERT: "#a855f7", NORMAL: "#10b981",
  };

  const steps = [
    {
      label: "Kill Switches",
      pass: !score.killSwitchBlocked,
      detail: score.killSwitchBlocked
        ? score.killSwitches.filter(k => !k.passed).map(k => k.name).join(", ")
        : "All clear",
    },
    {
      label: `Score ${score.totalScore}/${score.maxScore}`,
      pass: score.grade === "A" || score.grade === "B",
      detail: `Grade ${score.grade}`,
    },
    {
      label: `Gate ${gate}`,
      pass: gate === "NORMAL" || gate === "SELECTIVE",
      warn: gate === "ALERT" || gate === "RESTRICT",
      detail: regime?.layer1RegimeGate?.gateImplication?.split(".")[0] ?? "",
      color: GATE_COLOR[gate],
    },
    {
      label: "Tier 1 Structure",
      pass: t1 === true,
      detail: alignScore !== null ? `Alignment ${alignScore}/${alignMax}` : "—",
    },
    {
      label: "Tier 2 Fundamentals",
      pass: t2 === true,
      detail: t2 === true ? "CB + liquidity aligned" : t2 === false ? "Fails fundamental filter" : "—",
    },
  ];

  return (
    <div className="flex items-center gap-0 flex-wrap">
      {steps.map((s, i) => {
        const color = (s as any).color ?? (s.pass ? "#10b981" : s.warn ? "#f97316" : "#ef4444");
        const icon = s.pass ? "✓" : (s as any).warn ? "⚠" : "✗";
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center group relative cursor-default">
              <div
                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold"
                style={{ color, background: `${color}14`, border: `1px solid ${color}30` }}
                title={s.detail}
              >
                <span>{icon}</span>
                <span>{s.label}</span>
              </div>
              {/* Tooltip */}
              {s.detail && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-20 w-max max-w-48">
                  <div className="rounded px-2 py-1 text-[9px] leading-relaxed text-center shadow-xl"
                    style={{ background: "var(--bg-card-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    {s.detail}
                  </div>
                </div>
              )}
            </div>
            {i < steps.length - 1 && (
              <span className="text-[10px] px-0.5" style={{ color: "var(--text-muted)" }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── main banner ─────────────────────────────────────────────────────────────

export function SignalSummaryBanner({
  score,
  regime,
  tech,
}: {
  score: PairScore;
  regime: RegimePayload | null;
  tech: TechnicalContext | null;
}) {
  const dir = score.direction;
  const techSignals = tech ? extractTechSignals(tech, dir) : [];
  const { verdict, reason, color, bg, border } = computeVerdict(score, regime, techSignals);

  const dirColor = dir === "BUY" ? "#10b981" : dir === "SELL" ? "#ef4444" : dir === "WATCH" ? "#f59e0b" : "#64748b";

  const VERDICT_LABEL: Record<Verdict, string> = {
    CONFIRMED: "✓ CONFIRMED",
    WATCH: "👁 WATCH",
    BLOCKED: "✗ BLOCKED",
    "NO SIGNAL": "— NO SIGNAL",
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: bg, borderColor: border }}>
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
        {/* Left: verdict + direction */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-black tracking-wide" style={{ color }}>
            {VERDICT_LABEL[verdict]}
          </span>

          {(dir === "BUY" || dir === "SELL") && (
            <span className="text-xs font-bold px-2 py-0.5 rounded border"
              style={{ color: dirColor, background: `${dirColor}1a`, borderColor: `${dirColor}40` }}>
              {dir} {score.pair}
            </span>
          )}

          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{reason}</span>
        </div>

        {/* Right: grade badge */}
        <div className="flex items-center gap-2 shrink-0">
          {pill(`Grade ${score.grade}`, score.grade === "A" ? "#10b981" : score.grade === "B" ? "#3b82f6" : score.grade === "C" ? "#f59e0b" : "#64748b")}
          {pill(`${score.totalScore}/${score.maxScore} pts`, color)}
        </div>
      </div>

      {/* Step chain */}
      <div className="px-4 pb-3 flex flex-col gap-2">
        <StepChain score={score} regime={regime} />

        {/* Tech signals */}
        {techSignals.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Technical:
            </span>
            {techSignals.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold"
                style={{ color: s.color, background: `${s.color}14`, border: `1px solid ${s.color}30` }}>
                {s.icon} {s.label}
              </span>
            ))}
          </div>
        )}

        {/* Unlock condition(s) when blocked */}
        {verdict === "BLOCKED" && score.killSwitches.filter(k => !k.passed && k.unlockCondition).map((k, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[10px] mt-0.5"
            style={{ color: "#fbbf24" }}>
            <span>🎯</span>
            <span><strong>Unlock:</strong> {k.unlockCondition}</span>
          </div>
        ))}

        {/* R2 inversion alert */}
        {score.r2InversionNote && (
          <div className="flex items-start gap-1.5 text-[10px] mt-0.5"
            style={{ color: "#93c5fd" }}>
            <span>🔍</span>
            <span><strong>R2:</strong> {score.r2InversionNote}</span>
          </div>
        )}

        {/* Conflict flags */}
        {(regime?.conflictFlags?.length ?? 0) > 0 && (
          <div className="flex items-start gap-1.5 text-[10px] mt-0.5"
            style={{ color: "#c084fc" }}>
            <span>⚡</span>
            <span>
              <strong>{regime!.conflictFlags.length} conflict{regime!.conflictFlags.length > 1 ? "s" : ""}:</strong>{" "}
              {regime!.conflictFlags.map(f => f.description).join(" · ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── pair tab signal dot (exported for PairSelector) ─────────────────────────

export function pairSignalColor(
  score: PairScore,
  regime: RegimePayload | undefined,
  tech: TechnicalContext | undefined,
): string {
  if (score.killSwitchBlocked) return "#ef4444";
  const gate = regime?.layer1RegimeGate?.gateDecision;
  if (gate === "HALT") return "#ef4444";
  if (score.direction === "NO TRADE") return "#64748b";
  if (score.direction === "WATCH") return "#f59e0b";
  const t1 = regime?.layer2Tier1Structural?.tier1Pass;
  const t2 = regime?.layer2Tier2Fundamental?.tier2Pass;
  const techSignals = tech ? extractTechSignals(tech, score.direction) : [];
  const hasTechConfirm = techSignals.some(s => s.color === "#10b981");
  if (score.grade === "A" && t1 && t2 && hasTechConfirm) return "#10b981";
  if (score.grade === "A" || score.grade === "B") return "#3b82f6";
  return "#64748b";
}
