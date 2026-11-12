import type { SentimentData, PairSentiment } from "../lib/types";
import { Card, CardTitle } from "./Card";
import { Badge } from "./Badge";

function SentimentRow({ p }: { p: PairSentiment }) {
  const signalColor =
    p.signal === "fade-shorts" ? "green" :
    p.signal === "fade-longs" ? "red" : "muted";

  const signalLabel =
    p.signal === "fade-shorts" ? "BUY signal" :
    p.signal === "fade-longs" ? "SELL signal" : "neutral";

  const strengthColor =
    p.signalStrength === "strong" ? "bg-emerald-500" :
    p.signalStrength === "moderate" ? "bg-amber-500" : "bg-slate-500";

  return (
    <div className="flex flex-col gap-1 pb-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold tracking-tight">{p.symbol.slice(0, 3)}/{p.symbol.slice(3)}</span>
        <div className="flex items-center gap-1.5">
          {p.signalStrength !== "weak" && (
            <span className={`w-1.5 h-1.5 rounded-full ${strengthColor}`} />
          )}
          <Badge label={signalLabel} color={signalColor} size="xs" />
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-4 rounded overflow-hidden flex" style={{ background: "var(--border)" }}>
        <div
          className="h-full bg-emerald-500/70 transition-all duration-500"
          style={{ width: `${p.longPct}%` }}
        />
        <div
          className="h-full bg-red-500/70 flex-1 transition-all duration-500"
        />
        {/* Labels */}
        <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
          <span className="text-[9px] font-bold text-white/90">L {p.longPct.toFixed(0)}%</span>
          <span className="text-[9px] font-bold text-white/90">S {p.shortPct.toFixed(0)}%</span>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{p.interpretation}</p>
    </div>
  );
}

export function SentimentPanel({ data }: { data: SentimentData }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle>Retail Sentiment</CardTitle>
      </div>
      <div className="flex flex-col gap-2">
        {data.pairs.map((p) => (
          <SentimentRow key={p.symbol} p={p} />
        ))}
      </div>
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        Source: {data.source}
      </p>
    </Card>
  );
}
