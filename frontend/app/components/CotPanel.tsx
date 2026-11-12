import type { CotData, CotPosition } from "../lib/types";
import { Badge } from "./Badge";
import { Card, CardTitle } from "./Card";

function NetBar({ net, max }: { net: number; max: number }) {
  const pct = Math.min(Math.abs(net) / max, 1) * 100;
  const isLong = net >= 0;
  return (
    <div className="flex items-center gap-1.5 h-3">
      {/* Left / short side */}
      <div className="flex-1 flex justify-end">
        {!isLong && (
          <div className="h-2 rounded-l bg-red-500/60" style={{ width: `${pct}%` }} />
        )}
      </div>
      {/* Centre line */}
      <div className="w-px h-full shrink-0" style={{ background: "var(--border)" }} />
      {/* Right / long side */}
      <div className="flex-1">
        {isLong && (
          <div className="h-2 rounded-r bg-emerald-500/60" style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  );
}

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

function CotRow({ p, max }: { p: CotPosition; max: number }) {
  const biasColor = p.bias === "bullish" ? "green" : p.bias === "bearish" ? "red" : "muted";
  const changeColor = p.weeklyChange > 0 ? "text-emerald-400" : p.weeklyChange < 0 ? "text-red-400" : "text-slate-400";

  return (
    <div className="flex flex-col gap-1 py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">{p.pair}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold num ${changeColor}`}>
            {p.weeklyChange > 0 ? "+" : ""}{fmt(p.weeklyChange)} wk
          </span>
          <Badge label={`${p.bias} ${p.netPosition > 0 ? fmt(p.netPosition) : `(${fmt(Math.abs(p.netPosition))})`}`} color={biasColor} size="xs" />
        </div>
      </div>
      <NetBar net={p.netPosition} max={max} />
      <p className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>{p.signal}</p>
    </div>
  );
}

export function CotPanel({ data }: { data: CotData }) {
  const max = Math.max(...data.positions.map((p) => Math.abs(p.netPosition)), 1);
  const isMock = data.source.includes("mock");

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle>COT — Institutional Positioning</CardTitle>
        {isMock && <Badge label="mock data" color="yellow" size="xs" />}
      </div>
      <div className="flex flex-col">
        {data.positions.map((p) => (
          <CotRow key={p.currency} p={p} max={max} />
        ))}
      </div>
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{data.note}</p>
    </Card>
  );
}
