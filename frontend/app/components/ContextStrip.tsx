"use client";

import { useState, type ReactNode } from "react";
import type { MacroData, FredData } from "../lib/types";

/**
 * ContextStrip — demoted secondary information.
 *
 * Macro/FRED/COT/Sentiment/Calendar are inputs to the decision, not the
 * decision itself. Previously they occupied full-size cards competing with the
 * verdict. Here they compress to a single always-visible line of key values;
 * the full panels stay one click away behind the toggle.
 */

function trendColor(t: "bullish" | "bearish" | "neutral" | string) {
  return t === "bullish" ? "#34d399" : t === "bearish" ? "#f87171" : "#94a3b8";
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="num text-xs font-bold tabular-nums" style={{ color: color ?? "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

export function ContextStrip({
  macro,
  fred,
  children,
}: {
  macro: MacroData | null;
  fred: FredData | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>

      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-3 py-2 text-left overflow-x-auto"
      >
        <span className="text-[9px] font-bold uppercase tracking-wider shrink-0" style={{ color: "var(--text-muted)" }}>
          Context
        </span>

        {macro && (
          <>
            <Stat label="DXY" value={macro.dxy.price.toFixed(2)} color={trendColor(macro.dxy.trend)} />
            <Stat label="VIX" value={macro.vix.price.toFixed(1)} color={macro.vix.price > 25 ? "#f87171" : undefined} />
            <Stat label="Risk" value={macro.riskEnvironment.replace("-", " ")} color={
              macro.riskEnvironment === "risk-on" ? "#34d399" :
              macro.riskEnvironment === "risk-off" ? "#f87171" : undefined
            } />
            <Stat label="USD" value={macro.usdBias} color={trendColor(macro.usdBias)} />
            <Stat label="Gold" value={macro.gold.trend} color={trendColor(macro.gold.trend)} />
            <Stat label="HYG" value={macro.hyg.trend} color={trendColor(macro.hyg.trend)} />
          </>
        )}
        {fred && (
          <>
            <Stat label="Liquidity" value={fred.liquidityRegime} color={
              fred.liquidityRegime === "contracting" ? "#f87171" :
              fred.liquidityRegime === "expanding" ? "#34d399" : undefined
            } />
            <Stat label="Fed" value={fred.centralBankBias} />
          </>
        )}

        <span className="ml-auto text-[10px] shrink-0 pl-2" style={{ color: "var(--text-muted)" }}>
          {open ? "▾ hide detail" : "▸ detail"}
        </span>
      </button>

      {open && (
        <div className="border-t p-4 flex flex-col gap-6" style={{ borderColor: "var(--border)", background: "var(--bg-base)" }}>
          {children}
        </div>
      )}
    </div>
  );
}
