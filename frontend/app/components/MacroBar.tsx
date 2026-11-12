import type { MacroData } from "../lib/types";
import { Badge } from "./Badge";
import { Card } from "./Card";

function trendColor(trend: string) {
  if (trend === "bullish") return "text-emerald-400";
  if (trend === "bearish") return "text-red-400";
  return "text-slate-400";
}

function trendBadgeColor(trend: string): "green" | "red" | "muted" {
  if (trend === "bullish") return "green";
  if (trend === "bearish") return "red";
  return "muted";
}

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

function Tile({ indicator, label }: { indicator: MacroData[keyof MacroData] & { price?: number; trend?: string; changePct?: number; signal?: string }; label: string }) {
  const price = (indicator as any).price ?? 0;
  const trend = (indicator as any).trend ?? "neutral";
  const changePct = (indicator as any).changePct ?? 0;
  const signal = (indicator as any).signal ?? "";

  return (
    <div
      className="flex flex-col gap-1.5 p-3 rounded-lg border transition-colors"
      style={{ background: "var(--bg-card-2)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>{label}</span>
        <Badge label={trend} color={trendBadgeColor(trend)} size="xs" />
      </div>
      <div className={`text-xl font-bold num ${trendColor(trend)}`}>{fmt(price, label === "US10Y" ? 3 : 2)}</div>
      <div className={`text-xs num ${changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
        {changePct >= 0 ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
      </div>
      <div className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>{signal}</div>
    </div>
  );
}

export function MacroBar({ data }: { data: MacroData }) {
  const riskColor = data.riskEnvironment === "risk-on" ? "green" : data.riskEnvironment === "risk-off" ? "red" : "muted";
  const usdColor = data.usdBias === "bullish" ? "green" : data.usdBias === "bearish" ? "red" : "muted";

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
          Macro Engine
        </p>
        <div className="flex gap-2">
          <Badge label={`USD ${data.usdBias}`} color={usdColor} />
          <Badge label={data.riskEnvironment} color={riskColor} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <Tile indicator={data.dxy} label="DXY" />
        <Tile indicator={data.spx} label="S&P 500" />
        <Tile indicator={data.ndx} label="Nasdaq" />
        <Tile indicator={data.vix} label="VIX" />
        <Tile indicator={data.us10y} label="US10Y" />
      </div>

      {/* Risk Signals Strip — Early warning indicators */}
      <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
        <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--text-muted)" }}>
          Risk Signals
        </p>
        <div className="flex flex-wrap gap-2">
          {/* VVIX: Pre-panic detector */}
          {data.vvix && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-bold num"
              style={{
                background: data.vvix.price > 110 ? "rgba(251,146,60,0.1)" : "var(--bg-card-2)",
                borderColor: data.vvix.price > 110 ? "rgba(251,146,60,0.4)" : "var(--border)",
                color: data.vvix.price > 110 ? "#fb923c" : "var(--text-primary)",
              }}
            >
              <span>⚡</span>
              <span>VVIX {data.vvix.price.toFixed(0)}</span>
            </div>
          )}

          {/* SKEW: Tail risk hedging */}
          {data.skew && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-bold num"
              style={{
                background: data.skew.price > 140 && data.vix.price < 20 ? "rgba(251,146,60,0.1)" : "var(--bg-card-2)",
                borderColor: data.skew.price > 140 && data.vix.price < 20 ? "rgba(251,146,60,0.4)" : "var(--border)",
                color: data.skew.price > 140 && data.vix.price < 20 ? "#fb923c" : "var(--text-primary)",
              }}
            >
              <span>🎯</span>
              <span>SKEW {data.skew.price.toFixed(0)}</span>
            </div>
          )}

          {/* EEM: Global capital flight */}
          {data.eem && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-bold ${trendColor(data.eem.trend)}`}
              style={{
                background: data.eem.trend === "bearish" ? "rgba(239,68,68,0.1)" : "var(--bg-card-2)",
                borderColor: data.eem.trend === "bearish" ? "rgba(239,68,68,0.3)" : "var(--border)",
              }}
            >
              <span>🌍</span>
              <span>EEM {data.eem.trend}</span>
            </div>
          )}

          {/* SMH: Semiconductor strength */}
          {data.smh && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-bold ${trendColor(data.smh.trend)}`}
              style={{
                background: data.smh.trend === "bullish" ? "rgba(16,185,129,0.1)" : data.smh.trend === "bearish" ? "rgba(239,68,68,0.1)" : "var(--bg-card-2)",
                borderColor: data.smh.trend === "bullish" ? "rgba(16,185,129,0.3)" : data.smh.trend === "bearish" ? "rgba(239,68,68,0.3)" : "var(--border)",
              }}
            >
              <span>🔧</span>
              <span>SMH {data.smh.trend}</span>
            </div>
          )}

          {/* Gold/Silver Ratio */}
          {data.gsRatio > 0 && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-bold num"
              style={{
                background: data.gsRatio > 80 ? "rgba(251,146,60,0.1)" : "var(--bg-card-2)",
                borderColor: data.gsRatio > 80 ? "rgba(251,146,60,0.4)" : "var(--border)",
                color: data.gsRatio > 80 ? "#fb923c" : "var(--text-primary)",
              }}
            >
              <span>⚙️</span>
              <span>GSR {data.gsRatio.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
