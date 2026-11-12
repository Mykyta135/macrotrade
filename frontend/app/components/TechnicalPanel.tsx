import type { TechnicalContext, TimeframeAnalysis, TrendDirection, RSIResult, DonchianResult, BollingerResult } from "../lib/types";

const TREND_STYLE: Record<TrendDirection, { label: string; color: string }> = {
  uptrend:      { label: "↑ UP",    color: "#10b981" },
  downtrend:    { label: "↓ DOWN",  color: "#ef4444" },
  consolidation:{ label: "→ CONS",  color: "#94a3b8" },
};

const MOMENTUM_COLOR: Record<string, string> = {
  bullish: "#10b981",
  bearish: "#ef4444",
  neutral: "#94a3b8",
};

const STRENGTH_COLOR: Record<string, string> = {
  strong:   "#10b981",
  moderate: "#f59e0b",
  weak:     "#ef4444",
};

function TrendBadge({ trend }: { trend: TrendDirection }) {
  const s = TREND_STYLE[trend];
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
      style={{ color: s.color, background: `${s.color}18`, border: `1px solid ${s.color}40` }}>
      {s.label}
    </span>
  );
}

function TimeframeRow({ label, tf }: { label: string; tf: TimeframeAnalysis }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[10px]">
      {/* TF label */}
      <span className="w-8 shrink-0 font-bold" style={{ color: "var(--text-muted)" }}>{label}</span>

      {/* Trend */}
      <TrendBadge trend={tf.trend} />

      {/* BOS */}
      {tf.lastBOS && (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
          style={{ color: tf.lastBOS.direction === "bullish" ? "#10b981" : "#ef4444", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          BOS {tf.lastBOS.direction === "bullish" ? "↑" : "↓"} {tf.lastBOS.level.toFixed(4)}
        </span>
      )}

      {/* CHoCH warning */}
      {tf.choch && (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
          style={{ color: "#a855f7", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.3)" }}>
          CHoCH {tf.choch.direction === "bullish" ? "↑" : "↓"}
        </span>
      )}

      {/* Imbalance */}
      {tf.openImbalance && (
        <span className="text-[9px]" style={{ color: "#f59e0b" }}>IMB</span>
      )}

      {/* Volume spike */}
      {tf.volumeProfile?.volumeSpike && (
        <span className="text-[9px] font-bold" style={{ color: "#a855f7" }}>VOL↑</span>
      )}

      {/* Momentum */}
      <span className="ml-auto shrink-0 font-semibold" style={{ color: MOMENTUM_COLOR[tf.momentumBias] }}>
        {tf.momentumBias.toUpperCase()}
      </span>
    </div>
  );
}

// ── RSI gauge ────────────────────────────────────────────────────────────────

function RSIGauge({ rsi, tfLabel }: { rsi: RSIResult; tfLabel: string }) {
  const pct = Math.min(100, Math.max(0, rsi.value));
  const barColor = rsi.value > 70 ? "#ef4444" : rsi.value < 30 ? "#10b981" : "#94a3b8";
  const divColor = rsi.divergence === "bullish" ? "#10b981" : rsi.divergence === "bearish" ? "#ef4444" : "transparent";
  const hasDivergence = rsi.divergence !== "none";

  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-6 shrink-0 font-bold" style={{ color: "var(--text-muted)" }}>{tfLabel}</span>
      {/* gauge bar */}
      <div className="relative flex-1 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        {/* OB/OS zones */}
        <div className="absolute top-0 bottom-0 rounded-full opacity-20" style={{ left: "70%", right: 0, background: "#ef4444" }} />
        <div className="absolute top-0 bottom-0 rounded-full opacity-20" style={{ left: 0, right: "70%", background: "#10b981" }} />
        {/* value marker */}
        <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2"
          style={{ left: `calc(${pct}% - 4px)`, background: barColor, borderColor: "var(--bg-card)" }} />
      </div>
      <span className="num w-8 text-right font-semibold" style={{ color: barColor }}>{rsi.value}</span>
      {rsi.overbought && <span className="text-[9px] font-bold" style={{ color: "#ef4444" }}>OB</span>}
      {rsi.oversold && <span className="text-[9px] font-bold" style={{ color: "#10b981" }}>OS</span>}
      {hasDivergence && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse"
          style={{ color: divColor, background: `${divColor}18`, border: `1px solid ${divColor}40` }}>
          DIV {rsi.divergence === "bullish" ? "↑" : "↓"} {rsi.divergenceStrength === "strong" ? "!!" : "!"}
        </span>
      )}
    </div>
  );
}

// ── Donchian row ──────────────────────────────────────────────────────────────

function DonchianRow({ dc, price, tfLabel }: { dc: DonchianResult; price: number; tfLabel: string }) {
  const pct = dc.upper > dc.lower
    ? Math.min(100, Math.max(0, ((price - dc.lower) / (dc.upper - dc.lower)) * 100))
    : 50;
  const breakoutColor = dc.breakout === "bullish" ? "#10b981" : dc.breakout === "bearish" ? "#ef4444" : "var(--text-muted)";

  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-6 shrink-0 font-bold" style={{ color: "var(--text-muted)" }}>{tfLabel}</span>
      <div className="relative flex-1 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2"
          style={{ left: `calc(${pct}% - 4px)`, background: dc.breakout !== "none" ? breakoutColor : "#94a3b8", borderColor: "var(--bg-card)" }} />
      </div>
      <span className="num" style={{ color: "var(--text-muted)" }}>{dc.lower.toFixed(4)}</span>
      <span style={{ color: "var(--text-muted)" }}>–</span>
      <span className="num" style={{ color: "var(--text-muted)" }}>{dc.upper.toFixed(4)}</span>
      {dc.breakout !== "none" && (
        <span className="font-bold px-1.5 py-0.5 rounded text-[9px]"
          style={{ color: breakoutColor, background: `${breakoutColor}18`, border: `1px solid ${breakoutColor}40` }}>
          BREAK {dc.breakout === "bullish" ? "↑" : "↓"} {dc.breakoutStrength === "strong" ? "!!" : "!"}
        </span>
      )}
    </div>
  );
}

// ── Bollinger row ─────────────────────────────────────────────────────────────

function BollingerRow({ bb, price, tfLabel }: { bb: BollingerResult; price: number; tfLabel: string }) {
  const pct = bb.upper > bb.lower
    ? Math.min(100, Math.max(0, ((price - bb.lower) / (bb.upper - bb.lower)) * 100))
    : 50;

  const stateLabel = bb.squeeze ? "SQUEEZE" : bb.expansion ? "EXPAND" : null;
  const stateColor = bb.squeeze ? "#3b82f6" : "#a855f7";
  const walkLabel = bb.walkingUpperBand ? "WALK↑" : bb.walkingLowerBand ? "WALK↓" : null;
  const walkColor = bb.walkingUpperBand ? "#10b981" : "#ef4444";

  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-6 shrink-0 font-bold" style={{ color: "var(--text-muted)" }}>{tfLabel}</span>
      <div className="relative flex-1 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2"
          style={{ left: `calc(${pct}% - 4px)`, background: pct > 80 ? "#10b981" : pct < 20 ? "#ef4444" : "#94a3b8", borderColor: "var(--bg-card)" }} />
      </div>
      <span className="num text-[9px]" style={{ color: "var(--text-muted)" }}>{(bb.percentB * 100).toFixed(0)}%B</span>
      <span className="num text-[9px]" style={{ color: "var(--text-muted)" }}>BW:{bb.bandwidth.toFixed(2)}%</span>
      {stateLabel && (
        <span className="font-bold text-[9px] px-1 rounded" style={{ color: stateColor, background: `${stateColor}18`, border: `1px solid ${stateColor}35` }}>
          {stateLabel}
        </span>
      )}
      {walkLabel && (
        <span className="font-bold text-[9px] px-1 rounded" style={{ color: walkColor, background: `${walkColor}18`, border: `1px solid ${walkColor}35` }}>
          {walkLabel}
        </span>
      )}
    </div>
  );
}

function ZoneBlock({ label, zone, priceInside }: {
  label: string;
  zone: { high: number; low: number; strength: string } | null;
  priceInside: boolean;
}) {
  if (!zone) return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>None detected</span>
    </div>
  );

  const isD = label.toLowerCase().includes("demand");
  const baseColor = isD ? "#10b981" : "#ef4444";

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: "var(--text-muted)" }}>{label}</span>
        {priceInside && (
          <span className="text-[8px] px-1 py-0.5 rounded font-bold animate-pulse"
            style={{ color: baseColor, background: `${baseColor}20`, border: `1px solid ${baseColor}40` }}>
            PRICE HERE
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[10px]">
        <span className="num font-semibold" style={{ color: baseColor }}>
          {zone.low.toFixed(4)} – {zone.high.toFixed(4)}
        </span>
        <span style={{ color: STRENGTH_COLOR[zone.strength] ?? "#94a3b8" }}>{zone.strength}</span>
      </div>
    </div>
  );
}

export function TechnicalPanel({ data }: { data: TechnicalContext }) {
  if (!data.timeframes) {
    return (
      <div className="rounded-xl border p-4 text-xs" style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
        Technical data unavailable for {data.pair} — Yahoo Finance fetch failed.
      </div>
    );
  }
  const tfs = data.timeframes;
  const align = data.alignment;
  const pvz = data.priceVsZones;

  const alignColor = align.score >= 3 ? "#10b981" : align.score === 2 ? "#f59e0b" : "#ef4444";
  const alignDir = align.bullish.length > align.bearish.length ? "BULLISH" : align.bearish.length > align.bullish.length ? "BEARISH" : "MIXED";

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Technical Structure — {data.pair}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Price: <span className="num font-bold" style={{ color: "var(--text-primary)" }}>{data.currentPrice.toFixed(4)}</span>
          </span>
          {/* Alignment score badge */}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded border"
            style={{ color: alignColor, borderColor: `${alignColor}40`, background: `${alignColor}12` }}>
            {align.score}/{align.maxScore} {alignDir}
          </span>
        </div>
      </div>

      {/* Multi-TF breakdown */}
      <div className="flex flex-col divide-y divide-white/5">
        <TimeframeRow label="W" tf={tfs.weekly} />
        <TimeframeRow label="D" tf={tfs.daily} />
        <TimeframeRow label="4H" tf={tfs.h4} />
        <TimeframeRow label="1H" tf={tfs.h1} />
      </div>

      {/* Alignment detail */}
      {(align.bullish.length > 0 || align.bearish.length > 0) && (
        <div className="flex gap-4 text-[10px]">
          {align.bullish.length > 0 && (
            <div className="flex items-center gap-1">
              <span style={{ color: "#10b981" }}>↑ Bullish:</span>
              <span style={{ color: "var(--text-muted)" }}>{align.bullish.join(", ")}</span>
            </div>
          )}
          {align.bearish.length > 0 && (
            <div className="flex items-center gap-1">
              <span style={{ color: "#ef4444" }}>↓ Bearish:</span>
              <span style={{ color: "var(--text-muted)" }}>{align.bearish.join(", ")}</span>
            </div>
          )}
        </div>
      )}

      {/* ── RSI ─────────────────────────────────────────────────── */}
      {[
        { label: "W", rsi: tfs.weekly.rsi },
        { label: "D", rsi: tfs.daily.rsi },
        { label: "4H", rsi: tfs.h4.rsi },
        { label: "1H", rsi: tfs.h1.rsi },
      ].some(r => r.rsi) && (
        <div className="flex flex-col gap-1 rounded-lg px-3 py-2" style={{ background: "var(--bg-card-2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: "var(--text-muted)" }}>RSI (14)</span>
            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
              <span style={{ color: "#10b981" }}>▌ OS &lt;30</span>{"  "}<span style={{ color: "#ef4444" }}>OB &gt;70 ▐</span>
            </span>
          </div>
          {[
            { label: "W", rsi: tfs.weekly.rsi },
            { label: "D", rsi: tfs.daily.rsi },
            { label: "4H", rsi: tfs.h4.rsi },
            { label: "1H", rsi: tfs.h1.rsi },
          ].map(({ label, rsi }) =>
            rsi ? <RSIGauge key={label} rsi={rsi} tfLabel={label} /> : null
          )}
          {/* Highlight any divergence prominently */}
          {[
            { label: "Weekly", rsi: tfs.weekly.rsi },
            { label: "Daily", rsi: tfs.daily.rsi },
            { label: "H4", rsi: tfs.h4.rsi },
            { label: "H1", rsi: tfs.h1.rsi },
          ].filter(r => r.rsi != null && r.rsi.divergence !== "none").map(({ label, rsi }) => (
            <div key={label} className="text-[10px] px-2 py-1 rounded mt-0.5"
              style={{
                background: rsi!.divergence === "bullish" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${rsi!.divergence === "bullish" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                color: rsi!.divergence === "bullish" ? "#10b981" : "#ef4444",
              }}>
              ⚠ {label} RSI {rsi!.divergence} divergence{rsi!.divergenceStrength === "strong" ? " — strong signal" : ""}: price vs momentum disagree
            </div>
          ))}
        </div>
      )}

      {/* ── Donchian Channels ───────────────────────────────────── */}
      {[
        { label: "W", dc: tfs.weekly.donchian },
        { label: "D", dc: tfs.daily.donchian },
        { label: "4H", dc: tfs.h4.donchian },
        { label: "1H", dc: tfs.h1.donchian },
      ].some(r => r.dc) && (
        <div className="flex flex-col gap-1 rounded-lg px-3 py-2" style={{ background: "var(--bg-card-2)", border: "1px solid var(--border)" }}>
          <span className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: "var(--text-muted)" }}>
            Donchian Channels (20) — breakout = market making new 20-session extreme
          </span>
          {[
            { label: "W", dc: tfs.weekly.donchian },
            { label: "D", dc: tfs.daily.donchian },
            { label: "4H", dc: tfs.h4.donchian },
            { label: "1H", dc: tfs.h1.donchian },
          ].map(({ label, dc }) =>
            dc ? <DonchianRow key={label} dc={dc} price={data.currentPrice} tfLabel={label} /> : null
          )}
        </div>
      )}

      {/* ── Bollinger Bands ─────────────────────────────────────── */}
      {[
        { label: "W", bb: tfs.weekly.bollinger },
        { label: "D", bb: tfs.daily.bollinger },
        { label: "4H", bb: tfs.h4.bollinger },
        { label: "1H", bb: tfs.h1.bollinger },
      ].some(r => r.bb) && (
        <div className="flex flex-col gap-1 rounded-lg px-3 py-2" style={{ background: "var(--bg-card-2)", border: "1px solid var(--border)" }}>
          <span className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: "var(--text-muted)" }}>
            Bollinger Bands (20,2σ) — volatility only, not direction
          </span>
          {[
            { label: "W", bb: tfs.weekly.bollinger },
            { label: "D", bb: tfs.daily.bollinger },
            { label: "4H", bb: tfs.h4.bollinger },
            { label: "1H", bb: tfs.h1.bollinger },
          ].map(({ label, bb }) =>
            bb ? <BollingerRow key={label} bb={bb} price={data.currentPrice} tfLabel={label} /> : null
          )}
          {/* Squeeze alert */}
          {[tfs.daily.bollinger, tfs.h4.bollinger].some(bb => bb?.squeeze) && (
            <div className="text-[10px] px-2 py-1 rounded mt-0.5"
              style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", color: "#3b82f6" }}>
              ⊙ BB Squeeze — volatility compressed, breakout imminent. Wait for Donchian confirmation.
            </div>
          )}
          {[tfs.daily.bollinger, tfs.h4.bollinger].some(bb => bb?.walkingUpperBand || bb?.walkingLowerBand) && (
            <div className="text-[10px] px-2 py-1 rounded mt-0.5"
              style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)", color: "#a855f7" }}>
              ↑ Band Walk — strong trend in progress. RSI "overbought" is irrelevant here; ride the trend.
            </div>
          )}
        </div>
      )}

      <div className="w-full h-px" style={{ background: "var(--border)" }} />

      {/* Supply / Demand zones */}
      <div className="grid grid-cols-2 gap-4">
        <ZoneBlock
          label="Demand Zone (Daily)"
          zone={tfs.daily.demandZone}
          priceInside={pvz.insideDemand}
        />
        <ZoneBlock
          label="Supply Zone (Daily)"
          zone={tfs.daily.supplyZone}
          priceInside={pvz.insideSupply}
        />
      </div>

      {/* Distance to zones */}
      {!pvz.insideDemand && !pvz.insideSupply && (
        <div className="flex gap-4 text-[10px]" style={{ color: "var(--text-muted)" }}>
          {pvz.distanceToDemandPct > 0 && (
            <span>↓ {pvz.distanceToDemandPct.toFixed(2)}% to demand</span>
          )}
          {pvz.distanceToSupplyPct > 0 && (
            <span>↑ {pvz.distanceToSupplyPct.toFixed(2)}% to supply</span>
          )}
        </div>
      )}

      {/* Open Imbalance on daily */}
      {tfs.daily.openImbalance && (
        <div className="text-[10px] flex items-center gap-2 px-2 py-1.5 rounded border"
          style={{ borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.05)" }}>
          <span className="font-bold" style={{ color: "#f59e0b" }}>⬡ Open Imbalance (Daily)</span>
          <span className="num" style={{ color: "var(--text-muted)" }}>
            {tfs.daily.openImbalance.bottom.toFixed(4)} – {tfs.daily.openImbalance.top.toFixed(4)}
          </span>
          <span style={{ color: tfs.daily.openImbalance.direction === "bullish" ? "#10b981" : "#ef4444" }}>
            {tfs.daily.openImbalance.direction === "bullish" ? "↑" : "↓"}
          </span>
        </div>
      )}

      {/* Volume profile on daily */}
      {tfs.daily.volumeProfile && (
        <div className="text-[10px] flex items-center gap-3 px-2 py-1.5 rounded border"
          style={{ borderColor: "rgba(148,163,184,0.2)", background: "rgba(148,163,184,0.04)" }}>
          <span className="font-bold" style={{ color: "var(--text-muted)" }}>Volume</span>
          <span style={{ color: tfs.daily.volumeProfile.relativeVolume > 1.5 ? "#a855f7" : tfs.daily.volumeProfile.relativeVolume < 0.7 ? "#94a3b8" : "var(--text-primary)" }}>
            {tfs.daily.volumeProfile.relativeVolume.toFixed(2)}× avg
          </span>
          <span style={{ color: tfs.daily.volumeProfile.trend === "rising" ? "#10b981" : tfs.daily.volumeProfile.trend === "falling" ? "#ef4444" : "#94a3b8" }}>
            {tfs.daily.volumeProfile.trend === "rising" ? "↑ rising" : tfs.daily.volumeProfile.trend === "falling" ? "↓ falling" : "→ flat"}
          </span>
          {tfs.daily.volumeProfile.volumeSpike && (
            <span className="font-bold animate-pulse" style={{ color: "#a855f7" }}>SPIKE</span>
          )}
          {tfs.daily.volumeProfile.profileShape && tfs.daily.volumeProfile.profileShape !== "normal" && tfs.daily.volumeProfile.profileShape !== "unknown" && (
            <span className="font-bold px-1 rounded" style={{
              color: tfs.daily.volumeProfile.profileShape === "b_shape" ? "#10b981" : "#ef4444",
              background: tfs.daily.volumeProfile.profileShape === "b_shape" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            }}>
              {tfs.daily.volumeProfile.profileShape === "b_shape" ? "b-shape ↑MR" : "P-shape ↓MR"}
            </span>
          )}
        </div>
      )}

      {/* LVN levels on daily */}
      {(tfs.daily.volumeProfile?.lvnLevels?.length ?? 0) > 0 && (
        <div className="text-[10px] flex items-center gap-2 flex-wrap">
          <span className="font-bold" style={{ color: "var(--text-muted)" }}>LVN:</span>
          {tfs.daily.volumeProfile!.lvnLevels!.map((lvn, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded num"
              style={{
                color: lvn.type === "support" ? "#10b981" : "#ef4444",
                background: lvn.type === "support" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${lvn.type === "support" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
              }}>
              {lvn.type === "support" ? "S" : "R"} {lvn.price.toFixed(4)}
            </span>
          ))}
        </div>
      )}

      {/* Liquidity sweeps — multi-TF */}
      {[
        { label: "Daily", sweep: tfs.daily.liquiditySweep, flip: tfs.daily.liquidityFlip },
        { label: "H4", sweep: tfs.h4.liquiditySweep, flip: tfs.h4.liquidityFlip },
        { label: "H1", sweep: tfs.h1.liquiditySweep, flip: tfs.h1.liquidityFlip },
      ].map(({ label, sweep, flip }) => (
        (sweep || flip) ? (
          <div key={label} className="flex flex-col gap-1">
            {sweep && (
              <div className="text-[10px] flex items-center gap-2 px-2 py-1.5 rounded border"
                style={{
                  borderColor: sweep.direction === "bullish" ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)",
                  background: sweep.direction === "bullish" ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
                }}>
                <span className="font-bold" style={{ color: sweep.direction === "bullish" ? "#10b981" : "#ef4444" }}>
                  ⚡ {label} Sweep
                </span>
                <span style={{ color: sweep.direction === "bullish" ? "#10b981" : "#ef4444" }}>
                  {sweep.direction === "bullish" ? "SSL swept" : "BSL swept"}
                </span>
                <span className="num" style={{ color: "var(--text-muted)" }}>@ {sweep.level.toFixed(4)}</span>
                <span style={{ color: "var(--text-muted)" }}>· {sweep.recoveryCandles}c recovery</span>
              </div>
            )}
            {flip && flip.isActive && (
              <div className="text-[10px] flex items-center gap-2 px-2 py-1.5 rounded border"
                style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.06)" }}>
                <span className="font-bold" style={{ color: "#f59e0b" }}>↺ {label} Flip</span>
                <span className="num" style={{ color: "var(--text-primary)" }}>{flip.level.toFixed(4)}</span>
                <span style={{ color: flip.direction === "bullish" ? "#10b981" : "#ef4444" }}>
                  {flip.direction === "bullish" ? "→ demand" : "→ supply"}
                </span>
                <span style={{ color: "var(--text-muted)" }}>· {flip.distancePct.toFixed(2)}% away</span>
              </div>
            )}
          </div>
        ) : null
      ))}

      {/* Stacked zones */}
      {(data.stackedZones?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: "var(--text-muted)" }}>Stacked Confluence Zones</span>
          {data.stackedZones.map((z, i) => (
            <div key={i} className="text-[10px] flex items-center gap-2 px-2 py-1.5 rounded border"
              style={{
                borderColor: z.score >= 3 ? "rgba(168,85,247,0.5)" : "rgba(168,85,247,0.25)",
                background: "rgba(168,85,247,0.06)",
              }}>
              <span className="font-bold" style={{ color: "#a855f7" }}>
                {"★".repeat(z.score)} {z.score >= 3 ? "A+" : ""}
              </span>
              <span className="num" style={{ color: "var(--text-primary)" }}>{z.price.toFixed(4)}</span>
              <span style={{ color: z.direction === "demand" ? "#10b981" : "#ef4444" }}>
                {z.direction}
              </span>
              <span style={{ color: "var(--text-muted)" }}>{z.components.join(" + ")}</span>
            </div>
          ))}
        </div>
      )}

      {/* Session levels — BSL/SSL */}
      {data.sessionLevels && (data.sessionLevels.nearestBSL || data.sessionLevels.nearestSSL) && (
        <div className="flex flex-col gap-1">
          <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: "var(--text-muted)" }}>Session Liquidity Pools</span>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {data.sessionLevels.nearestBSL && (
              <div className="px-2 py-1.5 rounded border"
                style={{ borderColor: "rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.05)" }}>
                <div className="font-bold" style={{ color: "#10b981" }}>BSL (Buy-Side)</div>
                <div className="num" style={{ color: "var(--text-primary)" }}>{data.sessionLevels.nearestBSL.toFixed(4)}</div>
                {data.sessionLevels.distanceToBSLPct != null && (
                  <div style={{ color: "var(--text-muted)" }}>+{data.sessionLevels.distanceToBSLPct.toFixed(2)}% away</div>
                )}
              </div>
            )}
            {data.sessionLevels.nearestSSL && (
              <div className="px-2 py-1.5 rounded border"
                style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.05)" }}>
                <div className="font-bold" style={{ color: "#ef4444" }}>SSL (Sell-Side)</div>
                <div className="num" style={{ color: "var(--text-primary)" }}>{data.sessionLevels.nearestSSL.toFixed(4)}</div>
                {data.sessionLevels.distanceToSSLPct != null && (
                  <div style={{ color: "var(--text-muted)" }}>{data.sessionLevels.distanceToSSLPct.toFixed(2)}% away</div>
                )}
              </div>
            )}
          </div>
          {/* Asia / London session range */}
          {(data.sessionLevels.asiaHigh || data.sessionLevels.londonHigh) && (
            <div className="flex gap-4 text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              {data.sessionLevels.asiaHigh && data.sessionLevels.asiaLow && (
                <span>Asia: <span className="num">{data.sessionLevels.asiaLow.toFixed(4)}–{data.sessionLevels.asiaHigh.toFixed(4)}</span></span>
              )}
              {data.sessionLevels.londonHigh && data.sessionLevels.londonLow && (
                <span>London: <span className="num">{data.sessionLevels.londonLow.toFixed(4)}–{data.sessionLevels.londonHigh.toFixed(4)}</span></span>
              )}
              {data.sessionLevels.prevDayHigh && data.sessionLevels.prevDayLow && (
                <span>PrevDay: <span className="num">{data.sessionLevels.prevDayLow.toFixed(4)}–{data.sessionLevels.prevDayHigh.toFixed(4)}</span></span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
