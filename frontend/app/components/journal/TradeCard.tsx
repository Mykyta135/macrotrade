"use client";
import { useState } from "react";
import type { TradeJournal, UpdateTradePayload } from "../../lib/types";
import { CloseTradeForm } from "./CloseTradeForm";
import { EditTradeForm } from "./EditTradeForm";
import { journal } from "../../lib/api";

interface Props {
  trade: TradeJournal;
  onUpdate: (updated: TradeJournal) => void;
  onDelete: (id: number) => void;
}

const EMOTION_EMOJI: Record<number, string> = { 1: "😱", 2: "😟", 3: "😐", 4: "🙂", 5: "😌" };

function TrendBadge({ trend }: { trend: string | null }) {
  if (!trend) return null;
  const color = trend === "bullish" ? "var(--green)" : trend === "bearish" ? "var(--red)" : "var(--text-muted)";
  return <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color }}>{trend.slice(0, 4)}</span>;
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null;
  const color = grade === "A" ? "var(--green)" : grade === "B" ? "var(--yellow)" : grade === "C" ? "var(--orange)" : "var(--text-muted)";
  return <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "var(--bg-base)", border: `1px solid ${color}33`, color }}>{grade}</span>;
}

export function TradeCard({ trade, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOpen = trade.outcome === "OPEN";
  const outcomeColor = trade.outcome === "WIN" ? "var(--green)" : trade.outcome === "LOSS" ? "var(--red)" : trade.outcome === "BREAKEVEN" ? "var(--yellow)" : "var(--blue)";

  async function handleClose(dto: UpdateTradePayload) {
    const updated = await journal.update(trade.id, dto);
    onUpdate(updated);
    setClosing(false);
  }

  async function handleEdit(dto: UpdateTradePayload) {
    const updated = await journal.update(trade.id, dto);
    onUpdate(updated);
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this trade entry?")) return;
    setDeleting(true);
    try { await journal.delete(trade.id); onDelete(trade.id); }
    finally { setDeleting(false); }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      {/* Header row */}
      <div className="px-4 py-3 flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(e => !e)}
        style={{ borderBottom: expanded ? "1px solid var(--border)" : "none" }}>

        {/* Outcome indicator */}
        <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: outcomeColor }} />

        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-sm" style={{ color: trade.direction === "BUY" ? "var(--green)" : "var(--red)" }}>{trade.direction}</span>
          <span className="font-semibold text-sm">{trade.pair}</span>
          {trade.systemGrade && <GradeBadge grade={trade.systemGrade} />}
        </div>

        <div className="flex items-center gap-3 ml-auto text-xs num shrink-0">
          {trade.pnlPips !== null && (
            <span className="font-bold" style={{ color: Number(trade.pnlPips) >= 0 ? "var(--green)" : "var(--red)" }}>
              {Number(trade.pnlPips) >= 0 ? "+" : ""}{trade.pnlPips}p
            </span>
          )}
          <span className="font-bold px-2 py-0.5 rounded text-[10px]" style={{ background: `${outcomeColor}22`, color: outcomeColor }}>
            {trade.outcome}
          </span>
          <span style={{ color: "var(--text-muted)" }}>{trade.entryDate}</span>
          {trade.emotionRating && <span title={`Emotion: ${trade.emotionRating}/5`}>{EMOTION_EMOJI[trade.emotionRating]}</span>}
          {!trade.followedSystem && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "var(--yellow)", border: "1px solid rgba(245,158,11,0.2)" }}>OVERRIDE</span>}
          <span style={{ color: "var(--text-muted)", transform: expanded ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-4 flex flex-col gap-4">
          {editing ? (
            <EditTradeForm trade={trade} onSubmit={handleEdit} onCancel={() => setEditing(false)} />
          ) : closing ? (
            <CloseTradeForm trade={trade} onSubmit={handleClose} onCancel={() => setClosing(false)} />
          ) : (
            <>
              {/* Trade details grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div><span style={{ color: "var(--text-muted)" }}>Entry</span><div className="num font-semibold">{trade.entryPrice}</div></div>
                <div><span style={{ color: "var(--text-muted)" }}>SL</span><div className="num font-semibold" style={{ color: "var(--red)" }}>{trade.stopLoss}</div></div>
                <div><span style={{ color: "var(--text-muted)" }}>TP</span><div className="num font-semibold" style={{ color: "var(--green)" }}>{trade.takeProfit}</div></div>
                <div><span style={{ color: "var(--text-muted)" }}>R:R</span><div className="num font-semibold">{trade.riskRewardRatio ?? "—"}</div></div>
                {trade.exitPrice && <div><span style={{ color: "var(--text-muted)" }}>Exit</span><div className="num font-semibold">{trade.exitPrice}</div></div>}
                {trade.exitDate && <div><span style={{ color: "var(--text-muted)" }}>Exit Date</span><div>{trade.exitDate}</div></div>}
                {trade.pnlPercent !== null && <div><span style={{ color: "var(--text-muted)" }}>P&L %</span><div className="num font-semibold" style={{ color: Number(trade.pnlPercent) >= 0 ? "var(--green)" : "var(--red)" }}>{Number(trade.pnlPercent) >= 0 ? "+" : ""}{trade.pnlPercent}%</div></div>}
              </div>

              {/* System snapshot */}
              {(trade.systemGrade || trade.macroRiskEnv || trade.regimeGateDecision) && (
                <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--bg-card-2)", border: "1px solid var(--border)" }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>System Snapshot at Entry</span>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {trade.systemGrade && <span>Grade <GradeBadge grade={trade.systemGrade} /></span>}
                    {trade.systemScore != null && <span style={{ color: "var(--text-secondary)" }}>{trade.systemScore}/{trade.systemMaxScore} pts</span>}
                    {trade.macroRiskEnv && <span style={{ color: "var(--text-secondary)" }}>Risk: {trade.macroRiskEnv}</span>}
                    {trade.regimeGateDecision && <span style={{ color: "var(--text-secondary)" }}>Gate: {trade.regimeGateDecision}</span>}
                    {trade.knnRegime && <span style={{ color: "var(--text-secondary)" }}>Regime: {trade.knnRegime}</span>}
                    {trade.cbBias && <span style={{ color: "var(--text-secondary)" }}>CB: {trade.cbBias}</span>}
                    {trade.liquidityRegime && <span style={{ color: "var(--text-secondary)" }}>Liq: {trade.liquidityRegime}</span>}
                    {trade.dxyPrice != null && <span style={{ color: "var(--text-secondary)" }}>DXY: <span className="num">{Number(trade.dxyPrice).toFixed(2)}</span></span>}
                    {trade.vixPrice != null && <span style={{ color: "var(--text-secondary)" }}>VIX: <span className="num">{Number(trade.vixPrice).toFixed(1)}</span></span>}
                  </div>
                  {/* Trend alignment */}
                  {(trade.trendWeekly || trade.trendDaily) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Trends:</span>
                      {["W", "D", "H4", "H1"].map((tf, i) => {
                        const trend = [trade.trendWeekly, trade.trendDaily, trade.trendH4, trade.trendH1][i];
                        return trend ? <span key={tf}><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{tf}</span> <TrendBadge trend={trend} /></span> : null;
                      })}
                      {trade.alignmentScore != null && (
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Align: <span className="num">{trade.alignmentScore}/4</span></span>
                      )}
                    </div>
                  )}
                  {/* Kill switches */}
                  {trade.systemKillSwitches && trade.systemKillSwitches.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {trade.systemKillSwitches.map((k, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{
                          background: k.passed ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                          border: `1px solid ${k.passed ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                          color: k.passed ? "var(--green)" : "var(--red)",
                        }}>
                          {k.passed ? "✓" : "✗"} {k.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Rationale & notes */}
              {trade.entryRationale && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Entry Rationale</div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{trade.entryRationale}</p>
                </div>
              )}
              {trade.exitNotes && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Exit Notes</div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{trade.exitNotes}</p>
                </div>
              )}
              {trade.lessonsLearned && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--yellow)" }}>Lessons Learned</div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{trade.lessonsLearned}</p>
                </div>
              )}
              {trade.overrodeSignal && trade.overrideReason && (
                <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "var(--yellow)" }}>
                  Override: {trade.overrideReason}
                </div>
              )}

              {/* Tags */}
              {trade.tags && trade.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {trade.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg-card-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
                {isOpen && (
                  <button onClick={() => setClosing(true)}
                    className="px-4 py-2 rounded-lg text-xs font-bold"
                    style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "var(--blue)" }}>
                    Close Trade
                  </button>
                )}
                <button onClick={() => { setEditing(true); setClosing(false); }}
                  className="px-4 py-2 rounded-lg text-xs font-medium"
                  style={{ background: "var(--bg-card-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  Edit
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="px-4 py-2 rounded-lg text-xs ml-auto"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-muted)", opacity: deleting ? 0.5 : 1 }}>
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
