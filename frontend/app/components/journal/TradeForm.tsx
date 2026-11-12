"use client";
import { useState } from "react";
import type { ScoreData, MacroData, RegimeData, TechnicalData, CreateTradePayload, TradeDirection } from "../../lib/types";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "NZD/USD", "USD/CAD", "USD/CHF", "GBP/JPY"];

const EMOTION_LABELS: Record<number, string> = {
  1: "1 — Fear / FOMO",
  2: "2 — Anxious",
  3: "3 — Mixed",
  4: "4 — Mostly calm",
  5: "5 — Fully disciplined",
};

interface Props {
  score: ScoreData | null;
  macro: MacroData | null;
  regimes: RegimeData | null;
  technical: TechnicalData | null;
  onSubmit: (dto: CreateTradePayload) => Promise<void>;
  onCancel: () => void;
}

export function TradeForm({ score, macro, regimes, technical, onSubmit, onCancel }: Props) {
  const today = new Date().toISOString().split("T")[0];

  const [pair, setPair] = useState("EUR/USD");
  const [direction, setDirection] = useState<TradeDirection>("BUY");
  const [entryDate, setEntryDate] = useState(today);
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [entryRationale, setEntryRationale] = useState("");
  const [followedSystem, setFollowedSystem] = useState(true);
  const [overrodeSignal, setOverrodeSignal] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [emotionRating, setEmotionRating] = useState(3);
  const [tags, setTags] = useState("");
  const [useSystemSnapshot, setUseSystemSnapshot] = useState(true);
  const [saving, setSaving] = useState(false);

  // Pull live system data for selected pair
  const pairScore = score?.pairs?.find(p => p.pair === pair);
  const pairRegime = regimes?.[pair];
  const pairTech = technical?.[pair];

  const previewRR = (() => {
    const e = parseFloat(entryPrice), sl = parseFloat(stopLoss), tp = parseFloat(takeProfit);
    if (!e || !sl || !tp) return null;
    const risk = Math.abs(e - sl);
    const reward = Math.abs(tp - e);
    if (risk === 0) return null;
    return (reward / risk).toFixed(2);
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entryPrice || !stopLoss || !takeProfit) return;
    setSaving(true);
    try {
      const dto: CreateTradePayload = {
        pair, direction,
        entryDate,
        entryPrice: parseFloat(entryPrice),
        stopLoss: parseFloat(stopLoss),
        takeProfit: parseFloat(takeProfit),
        entryRationale: entryRationale || undefined,
        followedSystem,
        overrodeSignal,
        overrideReason: overrodeSignal ? overrideReason : undefined,
        emotionRating,
        tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      };

      if (useSystemSnapshot && pairScore) {
        dto.systemGrade = pairScore.grade;
        dto.systemScore = pairScore.totalScore;
        dto.systemMaxScore = pairScore.maxScore;
        dto.systemDirection = pairScore.direction;
        dto.systemKillSwitches = pairScore.killSwitches.map(k => ({ name: k.name, passed: k.passed }));
        dto.systemFactors = pairScore.factors.map(f => ({ name: f.name, score: f.score, maxScore: f.maxScore, status: f.status }));
      }
      if (useSystemSnapshot && macro) {
        dto.macroRiskEnv = macro.riskEnvironment;
        dto.macroUsdBias = macro.usdBias;
        dto.dxyPrice = macro.dxy?.price;
        dto.vixPrice = macro.vix?.price;
        dto.us10yPrice = macro.us10y?.price;
      }
      if (useSystemSnapshot && pairRegime) {
        dto.regimeGateDecision = pairRegime.layer1RegimeGate?.gateDecision;
        dto.knnRegime = pairRegime.layer1RegimeGate?.volatilityState;
        dto.cbBias = pairRegime.layer2Tier2Fundamental?.cbDivergenceDirection ?? undefined;
        dto.liquidityRegime = pairRegime.layer2Tier2Fundamental?.liquidityRegime;
      }
      if (useSystemSnapshot && pairTech) {
        dto.alignmentScore = pairTech.alignment?.score;
        dto.trendWeekly = pairTech.timeframes?.weekly?.trend;
        dto.trendDaily = pairTech.timeframes?.daily?.trend;
        dto.trendH4 = pairTech.timeframes?.h4?.trend;
        dto.trendH1 = pairTech.timeframes?.h1?.trend;
      }

      await onSubmit(dto);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1";
  const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)", boxShadow: "none" };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* System snapshot preview */}
      {useSystemSnapshot && pairScore && (
        <div className="rounded-lg p-3 flex flex-wrap gap-3 items-center text-xs"
          style={{ background: "var(--bg-card-2)", border: "1px solid var(--border)" }}>
          <span style={{ color: "var(--text-muted)" }}>System at capture:</span>
          <span className="font-bold" style={{
            color: pairScore.grade === "A" ? "var(--green)" : pairScore.grade === "B" ? "var(--yellow)" : pairScore.grade === "C" ? "var(--orange)" : "var(--text-muted)"
          }}>Grade {pairScore.grade}</span>
          <span className="num" style={{ color: "var(--text-secondary)" }}>{pairScore.totalScore}/{pairScore.maxScore} pts</span>
          <span className="font-semibold" style={{ color: pairScore.direction === "BUY" ? "var(--green)" : pairScore.direction === "SELL" ? "var(--red)" : "var(--text-muted)" }}>
            {pairScore.direction}
          </span>
          {pairScore.killSwitchBlocked && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "rgba(239,68,68,0.15)", color: "var(--red)" }}>KILL SWITCH</span>}
          {pairRegime && <span style={{ color: "var(--text-muted)" }}>· Regime: {pairRegime.layer1RegimeGate?.gateDecision}</span>}
          {pairTech && <span style={{ color: "var(--text-muted)" }}>· Align: {pairTech.alignment?.score}/{pairTech.alignment?.maxScore}</span>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Pair */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Pair</label>
          <select className={inputCls} style={inputStyle} value={pair} onChange={e => setPair(e.target.value)}>
            {PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Direction */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Direction</label>
          <div className="flex gap-2">
            {(["BUY", "SELL"] as TradeDirection[]).map(d => (
              <button key={d} type="button" onClick={() => setDirection(d)}
                className="flex-1 py-2 rounded-lg text-sm font-bold transition-colors"
                style={{
                  background: direction === d ? (d === "BUY" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)") : "var(--bg-base)",
                  border: `1px solid ${direction === d ? (d === "BUY" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)") : "var(--border)"}`,
                  color: direction === d ? (d === "BUY" ? "var(--green)" : "var(--red)") : "var(--text-muted)",
                }}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Entry Date</label>
          <input type="date" className={inputCls} style={inputStyle} value={entryDate} onChange={e => setEntryDate(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Entry Price</label>
          <input type="number" step="any" placeholder="1.08450" className={`${inputCls} num`} style={inputStyle}
            value={entryPrice} onChange={e => setEntryPrice(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Stop Loss</label>
          <input type="number" step="any" placeholder="1.07900" className={`${inputCls} num`} style={inputStyle}
            value={stopLoss} onChange={e => setStopLoss(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Take Profit</label>
          <input type="number" step="any" placeholder="1.09350" className={`${inputCls} num`} style={inputStyle}
            value={takeProfit} onChange={e => setTakeProfit(e.target.value)} required />
        </div>
      </div>

      {previewRR && (
        <div className="text-xs px-3 py-1.5 rounded-lg num" style={{ background: "var(--bg-card-2)", border: "1px solid var(--border)", color: parseFloat(previewRR) >= 2 ? "var(--green)" : parseFloat(previewRR) >= 1.5 ? "var(--yellow)" : "var(--text-muted)" }}>
          R:R = {previewRR} {parseFloat(previewRR) >= 2 ? "✓ Good" : parseFloat(previewRR) >= 1.5 ? "Acceptable" : "Low — reconsider"}
        </div>
      )}

      {/* Rationale */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Entry Rationale</label>
        <textarea rows={3} placeholder="Why did you take this trade? What setup triggered entry? Which system rules aligned?"
          className={inputCls} style={{ ...inputStyle, resize: "vertical" }}
          value={entryRationale} onChange={e => setEntryRationale(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* System adherence */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>System Adherence</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={followedSystem} onChange={e => setFollowedSystem(e.target.checked)} className="accent-emerald-500" />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>Followed system rules</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={overrodeSignal} onChange={e => setOverrodeSignal(e.target.checked)} className="accent-amber-500" />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>Overrode signal</span>
          </label>
          {overrodeSignal && (
            <input type="text" placeholder="Why did you override?" className={inputCls} style={inputStyle}
              value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
          )}
        </div>

        {/* Emotion */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Emotional State</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setEmotionRating(n)}
                className="flex-1 py-2 rounded-lg text-sm font-bold transition-colors"
                style={{
                  background: emotionRating === n ? (n >= 4 ? "rgba(16,185,129,0.15)" : n === 3 ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)") : "var(--bg-base)",
                  border: `1px solid ${emotionRating === n ? (n >= 4 ? "rgba(16,185,129,0.4)" : n === 3 ? "rgba(245,158,11,0.4)" : "rgba(239,68,68,0.4)") : "var(--border)"}`,
                  color: emotionRating === n ? (n >= 4 ? "var(--green)" : n === 3 ? "var(--yellow)" : "var(--red)") : "var(--text-muted)",
                }}>
                {n}
              </button>
            ))}
          </div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{EMOTION_LABELS[emotionRating]}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Tags (comma separated)</label>
          <input type="text" placeholder="breakout, london session, choch" className={inputCls} style={inputStyle}
            value={tags} onChange={e => setTags(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5 justify-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useSystemSnapshot} onChange={e => setUseSystemSnapshot(e.target.checked)} className="accent-blue-500" />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>Capture system snapshot</span>
          </label>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Saves live grade, score, regime, trends for post-analysis</p>
        </div>
      </div>

      <div className="flex gap-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-lg text-sm transition-colors"
          style={{ border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-secondary)" }}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors"
          style={{
            background: direction === "BUY" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${direction === "BUY" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: direction === "BUY" ? "var(--green)" : "var(--red)",
            opacity: saving ? 0.6 : 1,
          }}>
          {saving ? "Saving…" : `Log ${direction} ${pair}`}
        </button>
      </div>
    </form>
  );
}
