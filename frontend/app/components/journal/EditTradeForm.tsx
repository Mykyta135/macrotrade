"use client";
import { useState } from "react";
import type { TradeJournal, TradeOutcome, UpdateTradePayload } from "../../lib/types";

interface Props {
  trade: TradeJournal;
  onSubmit: (dto: UpdateTradePayload) => Promise<void>;
  onCancel: () => void;
}

const EMOTION_LABELS: Record<number, string> = {
  1: "1 — Fear / FOMO",
  2: "2 — Anxious",
  3: "3 — Mixed",
  4: "4 — Mostly calm",
  5: "5 — Fully disciplined",
};

export function EditTradeForm({ trade, onSubmit, onCancel }: Props) {
  const isClosed = trade.outcome !== "OPEN";

  // Entry fields
  const [entryRationale, setEntryRationale] = useState(trade.entryRationale ?? "");
  const [followedSystem, setFollowedSystem] = useState(trade.followedSystem);
  const [overrodeSignal, setOverrodeSignal] = useState(trade.overrodeSignal);
  const [overrideReason, setOverrideReason] = useState(trade.overrideReason ?? "");
  const [emotionRating, setEmotionRating] = useState(trade.emotionRating ?? 3);
  const [tags, setTags] = useState((trade.tags ?? []).join(", "));

  // Exit fields (only when already closed or being updated)
  const [outcome, setOutcome] = useState<TradeOutcome>(trade.outcome);
  const [exitDate, setExitDate] = useState(trade.exitDate ?? "");
  const [exitPrice, setExitPrice] = useState(trade.exitPrice != null ? String(trade.exitPrice) : "");
  const [pnlPips, setPnlPips] = useState(trade.pnlPips != null ? String(trade.pnlPips) : "");
  const [pnlPercent, setPnlPercent] = useState(trade.pnlPercent != null ? String(trade.pnlPercent) : "");
  const [exitNotes, setExitNotes] = useState(trade.exitNotes ?? "");
  const [lessonsLearned, setLessonsLearned] = useState(trade.lessonsLearned ?? "");

  const [saving, setSaving] = useState(false);

  // Auto-compute pips when exit price changes
  function handleExitPriceChange(val: string) {
    setExitPrice(val);
    const ep = parseFloat(val);
    if (!ep || !trade.entryPrice) return;
    const diff = trade.direction === "BUY"
      ? ep - Number(trade.entryPrice)
      : Number(trade.entryPrice) - ep;
    const isJpy = trade.pair.includes("JPY");
    const computed = Math.round(diff * (isJpy ? 100 : 10000));
    setPnlPips(String(computed));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const dto: UpdateTradePayload = {
        entryRationale: entryRationale || undefined,
        followedSystem,
        overrodeSignal,
        overrideReason: overrodeSignal ? (overrideReason || undefined) : undefined,
        emotionRating,
        tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      };
      if (outcome !== "OPEN") {
        dto.outcome = outcome;
        dto.exitDate = exitDate || undefined;
        dto.exitPrice = exitPrice ? parseFloat(exitPrice) : undefined;
        dto.pnlPips = pnlPips ? parseFloat(pnlPips) : undefined;
        dto.pnlPercent = pnlPercent ? parseFloat(pnlPercent) : undefined;
        dto.exitNotes = exitNotes || undefined;
        dto.lessonsLearned = lessonsLearned || undefined;
      } else {
        dto.outcome = "OPEN";
      }
      await onSubmit(dto);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
  const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)" };
  const labelCls = "text-xs font-medium";
  const labelStyle = { color: "var(--text-secondary)" };

  const pipsNum = parseFloat(pnlPips);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "var(--bg-card-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
        Editing: <span className="font-bold" style={{ color: trade.direction === "BUY" ? "var(--green)" : "var(--red)" }}>{trade.direction}</span> {trade.pair}
        {" "}@ <span className="num">{trade.entryPrice}</span> · {trade.entryDate}
      </div>

      {/* ── Entry fields ─────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label className={labelCls} style={labelStyle}>Entry Rationale</label>
        <textarea rows={3} placeholder="Why did you take this trade?"
          className={inputCls} style={{ ...inputStyle, resize: "vertical" }}
          value={entryRationale} onChange={e => setEntryRationale(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className={labelCls} style={labelStyle}>System Adherence</label>
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

        <div className="flex flex-col gap-2">
          <label className={labelCls} style={labelStyle}>Emotional State</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setEmotionRating(n)}
                className="flex-1 py-2 rounded-lg text-sm font-bold"
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

      <div className="flex flex-col gap-1.5">
        <label className={labelCls} style={labelStyle}>Tags (comma separated)</label>
        <input type="text" placeholder="breakout, london session, choch" className={inputCls} style={inputStyle}
          value={tags} onChange={e => setTags(e.target.value)} />
      </div>

      {/* ── Exit fields ───────────────────────────────── */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
        <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
          Exit Data {!isClosed && <span style={{ color: "var(--text-muted)", fontWeight: 400, textTransform: "none" }}>— fill in to close this trade</span>}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={labelStyle}>Outcome</label>
            <div className="flex gap-2">
              {(["OPEN", "WIN", "LOSS", "BREAKEVEN"] as TradeOutcome[]).map(o => (
                <button key={o} type="button" onClick={() => setOutcome(o)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold"
                  style={{
                    background: outcome === o
                      ? (o === "WIN" ? "rgba(16,185,129,0.15)" : o === "LOSS" ? "rgba(239,68,68,0.15)" : o === "OPEN" ? "rgba(59,130,246,0.15)" : "rgba(245,158,11,0.15)")
                      : "var(--bg-base)",
                    border: `1px solid ${outcome === o
                      ? (o === "WIN" ? "rgba(16,185,129,0.4)" : o === "LOSS" ? "rgba(239,68,68,0.4)" : o === "OPEN" ? "rgba(59,130,246,0.4)" : "rgba(245,158,11,0.4)")
                      : "var(--border)"}`,
                    color: outcome === o
                      ? (o === "WIN" ? "var(--green)" : o === "LOSS" ? "var(--red)" : o === "OPEN" ? "var(--blue)" : "var(--yellow)")
                      : "var(--text-muted)",
                  }}>
                  {o}
                </button>
              ))}
            </div>
          </div>

          {outcome !== "OPEN" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls} style={labelStyle}>Exit Date</label>
                  <input type="date" className={inputCls} style={inputStyle}
                    value={exitDate} onChange={e => setExitDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls} style={labelStyle}>Exit Price</label>
                  <input type="number" step="any" className={`${inputCls} num`} style={inputStyle}
                    value={exitPrice} onChange={e => handleExitPriceChange(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls} style={labelStyle}>P&L (pips)</label>
                  <input type="number" step="any" className={`${inputCls} num`} style={inputStyle}
                    value={pnlPips} onChange={e => setPnlPips(e.target.value)} />
                  {pnlPips && (
                    <span className="text-xs num" style={{ color: pipsNum >= 0 ? "var(--green)" : "var(--red)" }}>
                      {pipsNum >= 0 ? "+" : ""}{pnlPips} pips
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls} style={labelStyle}>P&L (%)</label>
                  <input type="number" step="any" placeholder="optional" className={`${inputCls} num`} style={inputStyle}
                    value={pnlPercent} onChange={e => setPnlPercent(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls} style={labelStyle}>Exit Notes</label>
                <textarea rows={2} placeholder="What happened? TP hit, SL, early exit?"
                  className={inputCls} style={{ ...inputStyle, resize: "vertical" }}
                  value={exitNotes} onChange={e => setExitNotes(e.target.value)} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls} style={labelStyle}>Lessons Learned</label>
                <textarea rows={2} placeholder="What will you do differently? What did the system get right or wrong?"
                  className={inputCls} style={{ ...inputStyle, resize: "vertical" }}
                  value={lessonsLearned} onChange={e => setLessonsLearned(e.target.value)} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <button type="button" onClick={onCancel}
          className="px-5 py-2.5 rounded-lg text-sm"
          style={{ border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-secondary)" }}>
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 rounded-lg text-sm font-bold"
          style={{
            background: "rgba(59,130,246,0.12)",
            border: "1px solid rgba(59,130,246,0.35)",
            color: "var(--blue)",
            opacity: saving ? 0.6 : 1,
          }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
