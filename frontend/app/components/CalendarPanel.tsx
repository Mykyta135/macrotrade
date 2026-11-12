import type { CalendarData, CalendarEvent } from "../lib/types";
import { Card, CardTitle } from "./Card";
import { Badge } from "./Badge";

const FLAG: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵",
  AUD: "🇦🇺", NZD: "🇳🇿", CAD: "🇨🇦", CHF: "🇨🇭",
};

function impactColor(impact: CalendarEvent["impact"]) {
  if (impact === "High") return "red";
  if (impact === "Medium") return "yellow";
  return "muted";
}

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <div className="shrink-0 text-base">{FLAG[event.country] ?? "🌐"}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold truncate">{event.title}</span>
          <Badge label={event.impact} color={impactColor(event.impact)} size="xs" />
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] num" style={{ color: "var(--text-muted)" }}>{event.time}</span>
          {event.forecast && (
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              F: {event.forecast}  P: {event.previous}
            </span>
          )}
          {event.minutesUntil !== null && event.minutesUntil > 0 && (
            <span className={`text-[10px] font-semibold ${event.minutesUntil <= 60 ? "text-amber-400" : "text-slate-400"}`}>
              in {event.minutesUntil}m
            </span>
          )}
        </div>
        {event.warning && (
          <p className="text-[10px] text-amber-400 mt-0.5 leading-tight">{event.warning}</p>
        )}
      </div>
    </div>
  );
}

export function CalendarPanel({ data }: { data: CalendarData }) {
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Economic Calendar</CardTitle>

      {data.dangerZoneActive && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2.5 flex gap-2 items-start">
          <span className="text-lg shrink-0">🚨</span>
          <p className="text-xs text-red-400 font-semibold leading-snug">{data.dangerZoneMessage}</p>
        </div>
      )}

      {!data.dangerZoneActive && data.highImpactNext24h.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          ⚠ {data.highImpactNext24h.length} high-impact event{data.highImpactNext24h.length > 1 ? "s" : ""} in next 24h — plan exits accordingly.
        </div>
      )}

      {data.events.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>No medium/high events this week.</p>
      ) : (
        <div className="flex flex-col">
          {data.events.map((e, i) => (
            <EventRow key={i} event={e} />
          ))}
        </div>
      )}
    </Card>
  );
}
