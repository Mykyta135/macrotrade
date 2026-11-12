"use client";

import { useEffect, useState } from "react";
import { journal } from "../lib/api";
import type { ScoreData, TradeJournal } from "../lib/types";

interface FlipAlert {
  trade: TradeJournal;
  prevDirection: string;
  newDirection: string;
  newGrade: string;
  newScore: number;
  severity: "major" | "minor"; // major = full reversal (BUY→SELL), minor = direction→WATCH/NOTRADE
}

function detectFlips(openTrades: TradeJournal[], score: ScoreData): FlipAlert[] {
  const alerts: FlipAlert[] = [];

  for (const trade of openTrades) {
    const current = score.pairs.find(p => p.pair === trade.pair);
    if (!current) continue;

    const prev = trade.direction; // what we entered as (BUY or SELL)
    const now = current.direction;

    // Full reversal: BUY→SELL or SELL→BUY
    if ((prev === "BUY" && now === "SELL") || (prev === "SELL" && now === "BUY")) {
      alerts.push({
        trade,
        prevDirection: prev,
        newDirection: now,
        newGrade: current.grade,
        newScore: current.totalScore,
        severity: "major",
      });
      continue;
    }

    // Direction dissolved: BUY or SELL → WATCH or NO TRADE (with a score drop)
    if ((prev === "BUY" || prev === "SELL") && (now === "WATCH" || now === "NO TRADE")) {
      alerts.push({
        trade,
        prevDirection: prev,
        newDirection: now,
        newGrade: current.grade,
        newScore: current.totalScore,
        severity: "minor",
      });
    }
  }

  return alerts;
}

export function FlipAlertBanner({ score }: { score: ScoreData }) {
  const [alerts, setAlerts] = useState<FlipAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    journal.list({ outcome: "OPEN", limit: 50 })
      .then(res => {
        const flips = detectFlips(res.trades, score);
        setAlerts(flips);
      })
      .catch(() => {}) // non-blocking
      .finally(() => setLoading(false));
  }, [score]);

  const visible = alerts.filter(a => !dismissed.has(a.trade.id));
  if (loading || visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visible.map(alert => {
        const isMajor = alert.severity === "major";
        const color = isMajor ? "#ef4444" : "#f97316";
        const dirColor = (d: string) =>
          d === "BUY" ? "#10b981" : d === "SELL" ? "#ef4444" : d === "WATCH" ? "#f59e0b" : "#64748b";

        return (
          <div
            key={alert.trade.id}
            className="rounded-xl border px-4 py-3 flex items-start gap-3"
            style={{
              background: `${color}08`,
              borderColor: `${color}40`,
              boxShadow: `0 0 16px ${color}18`,
            }}
          >
            <span className="text-lg shrink-0 mt-0.5">{isMajor ? "🔄" : "⚠"}</span>

            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black" style={{ color }}>
                  {isMajor ? "SIGNAL FLIP" : "SIGNAL DISSOLVED"}
                </span>
                <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                  {alert.trade.pair}
                </span>
                {/* Arrow: prev → new */}
                <div className="flex items-center gap-1 text-xs font-bold">
                  <span style={{ color: dirColor(alert.prevDirection) }}>{alert.prevDirection}</span>
                  <span style={{ color: "var(--text-muted)" }}>→</span>
                  <span style={{ color: dirColor(alert.newDirection) }}>{alert.newDirection}</span>
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border"
                  style={{
                    color: alert.newGrade === "A" ? "#10b981" : alert.newGrade === "B" ? "#3b82f6" : "#64748b",
                    background: "transparent",
                    borderColor: "var(--border)",
                  }}>
                  Grade {alert.newGrade} · {alert.newScore}/{score.pairs.find(p => p.pair === alert.trade.pair)?.maxScore ?? 5}
                </span>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {isMajor
                  ? `You have an open ${alert.prevDirection} on ${alert.trade.pair} (entered ${new Date(alert.trade.entryDate).toLocaleDateString()}). The system now signals ${alert.newDirection} — conditions have fully reversed. Review your position immediately.`
                  : `Your open ${alert.prevDirection} on ${alert.trade.pair} no longer has a clear system signal (now ${alert.newDirection}). Consider tightening stop or waiting for re-entry conditions.`
                }
              </p>

              <div className="flex items-center gap-2 mt-0.5">
                <a
                  href="/journal"
                  className="text-[10px] font-bold px-2 py-0.5 rounded border"
                  style={{ color, borderColor: `${color}50`, background: `${color}12` }}
                >
                  Review trade →
                </a>
                <button
                  onClick={() => setDismissed(prev => new Set(prev).add(alert.trade.id))}
                  className="text-[10px] px-2 py-0.5 rounded border"
                  style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "transparent" }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
