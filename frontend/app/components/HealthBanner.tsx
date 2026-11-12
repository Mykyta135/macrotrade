"use client";

import { useEffect, useState } from "react";

/**
 * Показує проблеми з джерелами даних просто на дашборді.
 *
 * Сенс: раніше зламане джерело (USD/CNH = 0) тихо занижувало бали пів року.
 * Тепер це видно там, де ви й так дивитесь — а не лише в логах сервера.
 */

interface Issue {
  source: string;
  field?: string;
  state: "ok" | "degraded" | "broken";
  message: string;
  affects?: string[];
}

interface Health {
  state: "ok" | "degraded" | "broken";
  summary: string;
  affectedPairs: string[];
  issues: Issue[];
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3901/api";

export function HealthBanner() {
  const [h, setH] = useState<Health | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${BASE}/health`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setH(d))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!h || h.state === "ok") return null;

  const broken = h.state === "broken";
  const c = broken
    ? { fg: "#f87171", bd: "rgba(239,68,68,0.35)", bg: "rgba(239,68,68,0.07)" }
    : { fg: "#fbbf24", bd: "rgba(245,158,11,0.35)", bg: "rgba(245,158,11,0.07)" };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: c.bd, background: c.bg }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left">
        <span>{broken ? "🔴" : "🟡"}</span>
        <span className="text-xs font-bold" style={{ color: c.fg }}>
          {broken ? "Дані неповні" : "Дані часткові"}
        </span>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{h.summary}</span>
        {h.affectedPairs.length > 0 && h.affectedPairs.length <= 3 && (
          <span className="text-[11px]" style={{ color: c.fg }}>
            — впливає на {h.affectedPairs.join(", ")}
          </span>
        )}
        <span className="ml-auto text-[10px]" style={{ color: "var(--text-muted)" }}>
          {open ? "▾" : "▸"} деталі
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3 flex flex-col gap-2 border-t pt-2.5" style={{ borderColor: c.bd }}>
          {h.issues.map((i, n) => (
            <div key={n} className="text-[11px] leading-relaxed">
              <span className="font-bold" style={{ color: i.state === "broken" ? "#f87171" : "#fbbf24" }}>
                {i.source}{i.field ? `.${i.field}` : ""}
              </span>
              <span style={{ color: "var(--text-secondary)" }}> — {i.message}</span>
              {i.affects && i.affects.length > 0 && (
                <span style={{ color: "var(--text-muted)" }}> (пари: {i.affects.join(", ")})</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
