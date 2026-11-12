import type { FredData, FredSeries } from "../lib/types";
import { Card, CardTitle } from "./Card";
import { Badge } from "./Badge";

function trendArrow(trend: FredSeries["trend"]) {
  if (trend === "rising") return <span className="text-emerald-400">▲</span>;
  if (trend === "falling") return <span className="text-red-400">▼</span>;
  return <span className="text-slate-400">—</span>;
}

function SeriesRow({ s, label }: { s: FredSeries; label: string }) {
  const changeColor = s.change > 0 ? "text-emerald-400" : s.change < 0 ? "text-red-400" : "text-slate-400";
  return (
    <div className="flex flex-col gap-1 py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold num ${changeColor}`}>
            {s.change > 0 ? "+" : ""}{s.change.toFixed(2)}{s.unit}
          </span>
          {trendArrow(s.trend)}
          <span className="text-base font-bold num">{s.latestValue.toFixed(2)}<span className="text-xs text-slate-500">{s.unit}</span></span>
        </div>
      </div>
      <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.interpretation}</p>
    </div>
  );
}

const biasColor = (b: string) => b === "hawkish" ? "green" : b === "dovish" ? "red" : "muted";
const usdColor = (b: string) => b === "bullish" ? "green" : b === "bearish" ? "red" : "muted";

export function FredPanel({ data }: { data: FredData }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle>Fundamentals (FRED)</CardTitle>
        <div className="flex gap-1.5">
          <Badge label={`Fed ${data.centralBankBias}`} color={biasColor(data.centralBankBias) as any} />
          <Badge label={`USD ${data.usdFundamentalBias}`} color={usdColor(data.usdFundamentalBias) as any} />
        </div>
      </div>

      <SeriesRow s={data.cpi} label="US CPI (Inflation)" />
      <SeriesRow s={data.unemployment} label="Unemployment Rate" />
      <SeriesRow s={data.fedRate} label="Fed Funds Rate" />

      <div
        className="rounded-lg px-3 py-2 text-xs leading-relaxed border"
        style={{ background: "var(--bg-card-2)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        {data.summary}
      </div>

      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Source: {data.source}</p>
    </Card>
  );
}
