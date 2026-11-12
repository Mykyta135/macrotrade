"use client";
import { useEffect, useState, useCallback } from "react";
import { journal, api } from "../lib/api";
import type {
  TradeJournal, JournalStats, ScoreData, MacroData,
  RegimeData, TechnicalData, TechnicalContext, CreateTradePayload,
} from "../lib/types";
import { TradeForm } from "../components/journal/TradeForm";
import { TradeCard } from "../components/journal/TradeCard";
import { StatsPanel } from "../components/journal/StatsPanel";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "NZD/USD", "USD/CAD", "USD/CHF", "GBP/JPY"];

type Tab = "trades" | "stats";
type OutcomeFilter = "ALL" | "OPEN" | "WIN" | "LOSS" | "BREAKEVEN";

export default function JournalPage() {
  const [tab, setTab] = useState<Tab>("trades");
  const [trades, setTrades] = useState<TradeJournal[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Filters
  const [filterPair, setFilterPair] = useState("ALL");
  const [filterOutcome, setFilterOutcome] = useState<OutcomeFilter>("ALL");
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 20;

  // Live system data for trade form
  const [score, setScore] = useState<ScoreData | null>(null);
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [regimes, setRegimes] = useState<RegimeData | null>(null);
  const [technical, setTechnical] = useState<TechnicalData | null>(null);

  const loadTrades = useCallback(async () => {
    setLoading(true);
    try {
      const result = await journal.list({
        pair: filterPair !== "ALL" ? filterPair : undefined,
        outcome: filterOutcome !== "ALL" ? filterOutcome : undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setTrades(result.trades);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [filterPair, filterOutcome, offset]);

  const loadStats = useCallback(async () => {
    const s = await journal.stats();
    setStats(s);
  }, []);

  // Load system data once for trade form (non-blocking)
  useEffect(() => {
    Promise.all([
      api.score().catch(() => null),
      api.macro().catch(() => null),
      api.regimes().catch(() => null),
      api.technical().catch(() => null),
    ]).then(([s, m, r, t]) => {
      setScore(s);
      setMacro(m);
      setRegimes(r);
      setTechnical(t);
    });
  }, []);

  useEffect(() => { loadTrades(); }, [loadTrades]);
  useEffect(() => { if (tab === "stats") loadStats(); }, [tab, loadStats]);

  async function handleCreate(dto: CreateTradePayload) {
    await journal.create(dto);
    setShowForm(false);
    setOffset(0);
    await Promise.all([loadTrades(), loadStats()]);
  }

  function handleUpdate(updated: TradeJournal) {
    setTrades(prev => prev.map(t => t.id === updated.id ? updated : t));
    loadStats();
  }

  function handleDelete(id: number) {
    setTrades(prev => prev.filter(t => t.id !== id));
    setTotal(t => t - 1);
    loadStats();
  }

  const openCount = trades.filter(t => t.outcome === "OPEN").length;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b px-6 py-3 flex items-center justify-between"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm" style={{ color: "var(--text-muted)" }}>← Dashboard</a>
          <span style={{ color: "var(--border)" }}>|</span>
          <span className="text-base font-bold tracking-tight">Trade Journal</span>
          {stats && (
            <span className="text-xs px-2 py-0.5 rounded border font-medium"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--bg-base)" }}>
              {stats.totalTrades} trades · {stats.winRate}% WR
            </span>
          )}
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg text-sm font-bold"
          style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "var(--green)" }}>
          + Log Trade
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* Log trade modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-base">Log New Trade</h2>
                <button onClick={() => setShowForm(false)} style={{ color: "var(--text-muted)" }}>✕</button>
              </div>
              <TradeForm
                score={score}
                macro={macro}
                regimes={regimes}
                technical={technical}
                onSubmit={handleCreate}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {(["trades", "stats"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-2 rounded-lg text-sm font-medium capitalize transition-colors"
              style={{
                background: tab === t ? "var(--bg-card-2)" : "transparent",
                color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
                border: tab === t ? "1px solid var(--border)" : "1px solid transparent",
              }}>
              {t === "trades" ? `Trades ${total > 0 ? `(${total})` : ""}` : "Statistics"}
            </button>
          ))}
        </div>

        {tab === "trades" && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <select value={filterPair} onChange={e => { setFilterPair(e.target.value); setOffset(0); }}
                className="rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="ALL">All Pairs</option>
                {PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              <div className="flex gap-1">
                {(["ALL", "OPEN", "WIN", "LOSS", "BREAKEVEN"] as OutcomeFilter[]).map(o => (
                  <button key={o} onClick={() => { setFilterOutcome(o); setOffset(0); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{
                      background: filterOutcome === o ? "var(--bg-card-2)" : "var(--bg-card)",
                      border: `1px solid ${filterOutcome === o ? "var(--border)" : "transparent"}`,
                      color: filterOutcome === o
                        ? (o === "WIN" ? "var(--green)" : o === "LOSS" ? "var(--red)" : o === "OPEN" ? "var(--blue)" : o === "BREAKEVEN" ? "var(--yellow)" : "var(--text-primary)")
                        : "var(--text-muted)",
                    }}>
                    {o}
                  </button>
                ))}
              </div>

              {openCount > 0 && (
                <span className="text-xs px-2 py-1 rounded-lg ml-auto num"
                  style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", color: "var(--blue)" }}>
                  {openCount} open
                </span>
              )}
            </div>

            {/* Trade list */}
            {loading ? (
              <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>Loading trades…</div>
            ) : trades.length === 0 ? (
              <div className="text-center py-16 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>No trades found</p>
                <button onClick={() => setShowForm(true)}
                  className="text-sm px-4 py-2 rounded-lg mt-2"
                  style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "var(--green)" }}>
                  Log your first trade
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {trades.map(t => (
                  <TradeCard key={t.id} trade={t} onUpdate={handleUpdate} onDelete={handleDelete} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-3">
                <button disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: offset === 0 ? "var(--text-muted)" : "var(--text-primary)", opacity: offset === 0 ? 0.4 : 1 }}>
                  ← Prev
                </button>
                <span className="text-xs num" style={{ color: "var(--text-muted)" }}>
                  {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
                </span>
                <button disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(o => o + PAGE_SIZE)}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: offset + PAGE_SIZE >= total ? "var(--text-muted)" : "var(--text-primary)", opacity: offset + PAGE_SIZE >= total ? 0.4 : 1 }}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {tab === "stats" && (
          stats ? <StatsPanel stats={stats} /> : (
            <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>Loading statistics…</div>
          )
        )}

        <footer className="text-center text-[10px] pb-4" style={{ color: "var(--text-muted)" }}>
          System snapshots captured at trade entry. Win rate and P&L based on closed trades only.
        </footer>
      </main>
    </div>
  );
}
