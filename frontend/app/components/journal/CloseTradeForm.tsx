"use client";
import { useState } from "react";
import type { TradeJournal, TradeOutcome, UpdateTradePayload } from "../../lib/types";

interface Props {
  trade: TradeJournal;
  onSubmit: (dto: UpdateTradePayload) => Promise<void>;
  onCancel: () => void;
}

export function CloseTradeForm({ trade, onSubmit, onCancel }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const [exitDate, setExitDate] = useState(today);
  const [exitPrice, setExitPrice] = useState("");
  const [outcome, setOutcome] = useState<TradeOutcome>("WIN");
  const [exitNotes, setExitNotes] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [saving, setSaving] = useState(false);

  const pnlPips = (() => {
    const ep = parseFloat(exitPrice);
    if (!ep || !trade.entryPrice) return null;
    const diff = (trade.direction === "BUY" ? ep - Number(trade.entryPrice) : Number(trade.entryPrice) - ep);
    const isJpy = trade.pair.includes("JPY");
    return Math.round(diff * (isJpy ? 100 : 10000));
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        exitDate,
        exitPrice: parseFloat(exitPrice),
        outcome,
        pnlPips: pnlPips ?? undefined,
        exitNotes: exitNotes || undefined,
        lessonsLearned: lessonsLearned || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1";
  const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)" };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "var(--bg-card-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
        Closing: <span className="font-bold" style={{ color: trade.direction === "BUY" ? "var(--green)" : "var(--red)" }}>{trade.direction}</span> {trade.pair} @ <span className="num">{trade.entryPrice}</span>
        {trade.systemGrade && <> · Grade <span className="font-bold">{trade.systemGrade}</span></>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Exit Date</label>
          <input type="date" className={inputCls} style={inputStyle} value={exitDate} onChange={e => setExitDate(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Exit Price</label>
          <input type="number" step="any" className={`${inputCls} num`} style={inputStyle}
            value={exitPrice} onChange={e => setExitPrice(e.target.value)} required />
        </div>
      </div>

      {pnlPips !== null && (
        <div className="text-sm px-3 py-2 rounded-lg num font-bold" style={{
          background: pnlPips >= 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${pnlPips >= 0 ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
          color: pnlPips >= 0 ? "var(--green)" : "var(--red)",
        }}>
          {pnlPips >= 0 ? "+" : ""}{pnlPips} pips
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Outcome</label>
        <div className="flex gap-2">
          {(["WIN", "LOSS", "BREAKEVEN"] as TradeOutcome[]).map(o => (
            <button key={o} type="button" onClick={() => setOutcome(o)}
              className="flex-1 py-2 rounded-lg text-xs font-bold"
              style={{
                background: outcome === o ? (o === "WIN" ? "rgba(16,185,129,0.15)" : o === "LOSS" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)") : "var(--bg-base)",
                border: `1px solid ${outcome === o ? (o === "WIN" ? "rgba(16,185,129,0.4)" : o === "LOSS" ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.4)") : "var(--border)"}`,
                color: outcome === o ? (o === "WIN" ? "var(--green)" : o === "LOSS" ? "var(--red)" : "var(--yellow)") : "var(--text-muted)",
              }}>
              {o}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Exit Notes</label>
        <textarea rows={2} placeholder="What happened? Did price reach TP/SL? Any partial closes?" className={inputCls}
          style={{ ...inputStyle, resize: "vertical" }} value={exitNotes} onChange={e => setExitNotes(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Lessons Learned</label>
        <textarea rows={2} placeholder="What will you do differently next time? What did the system get right or wrong?"
          className={inputCls} style={{ ...inputStyle, resize: "vertical" }}
          value={lessonsLearned} onChange={e => setLessonsLearned(e.target.value)} />
      </div>

      <div className="flex gap-3 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-lg text-sm"
          style={{ border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-secondary)" }}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-bold"
          style={{
            background: outcome === "WIN" ? "rgba(16,185,129,0.15)" : outcome === "LOSS" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
            border: `1px solid ${outcome === "WIN" ? "rgba(16,185,129,0.4)" : outcome === "LOSS" ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.4)"}`,
            color: outcome === "WIN" ? "var(--green)" : outcome === "LOSS" ? "var(--red)" : "var(--yellow)",
            opacity: saving ? 0.6 : 1,
          }}>
          {saving ? "Saving…" : `Close as ${outcome}`}
        </button>
      </div>
    </form>
  );
}
