"use client";

import { useState, useCallback, useTransition } from "react";
import { MacroBar } from "./MacroBar";
import { SentimentPanel } from "./SentimentPanel";
import { CalendarPanel } from "./CalendarPanel";
import { FredPanel } from "./FredPanel";
import { CotPanel } from "./CotPanel";
import { PairSelector } from "./PairSelector";
import { CascadeTable } from "./CascadeTable";
import { ContextStrip } from "./ContextStrip";
import { HealthBanner } from "./HealthBanner";
import { VerdictChart } from "./VerdictChart";
import { RegimeGatePanelClient } from "./RegimeGatePanelClient";
import { FlipAlertBanner } from "./FlipAlertBanner";
import { CopyButton } from "./CopyButton";
import type {
  MacroData, SentimentData, CotData, CalendarData, FredData,
  ScoreData, MlResult, RegimeData, TechnicalData, TechnicalContext,
} from "../lib/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const MIN_DATE = "2020-01-02";
const TODAY = new Date().toISOString().split("T")[0];

function toWeekday(s: string): string {
  const d = new Date(s + "T00:00:00Z");
  const day = d.getUTCDay();
  if (day === 0) d.setUTCDate(d.getUTCDate() - 2); // Sunday → Friday
  if (day === 6) d.setUTCDate(d.getUTCDate() - 1); // Saturday → Friday
  return d.toISOString().split("T")[0];
}

function addTradingDays(d: string, n: number): string {
  const date = new Date(d + "T00:00:00Z");
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + step);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  const s = date.toISOString().split("T")[0];
  return s < MIN_DATE ? MIN_DATE : s > TODAY ? TODAY : s;
}

interface LiveData {
  macro: MacroData | null;
  sentiment: SentimentData | null;
  cot: CotData | null;
  calendar: CalendarData | null;
  fred: FredData | null;
  score: ScoreData | null;
  mlResults: MlResult[] | null;
  regimes: RegimeData | null;
  technical: TechnicalData | null;
}

async function fetchLive(): Promise<LiveData> {
  const fetchers = [
    fetch(`${BASE}/macro`,          { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${BASE}/sentiment`,      { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${BASE}/cot`,            { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${BASE}/calendar`,       { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${BASE}/fred`,           { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${BASE}/score`,          { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${BASE}/ml`,             { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${BASE}/ml/regime/all`,  { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${BASE}/technical`,      { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
  ];
  const [macro, sentiment, cot, calendar, fred, score, mlResults, regimes, technicalRaw] = await Promise.all(fetchers);
  let technical: TechnicalData | null = null;
  if (technicalRaw?.pairs) {
    technical = {};
    for (const t of technicalRaw.pairs as TechnicalContext[]) technical[t.pair] = t;
  }
  return { macro, sentiment, cot, calendar, fred, score, mlResults, regimes, technical };
}

async function fetchHistorical(date: string, bust = false): Promise<LiveData> {
  const url = bust ? `${BASE}/backtest?date=${date}&refresh=1` : `${BASE}/backtest?date=${date}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Backtest failed: ${res.status}`);
  const bt = await res.json();

  // Score — backtest now returns the full shape matching live ScoreData
  const score: ScoreData | null = bt.score ?? null;

  // Calendar — map to CalendarData shape
  const calendar: CalendarData | null = bt.calendar ? {
    events: (bt.calendar.events ?? []).map((e: any) => ({
      title: e.title,
      country: e.country,
      date: e.date,
      time: "",
      impact: "High" as const,
      forecast: e.forecast ?? "",
      previous: e.previous ?? "",
      actual: e.actual ?? "",
      isUpcoming: e.isUpcoming ?? false,
      minutesUntil: null,
      warning: null,
    })),
    highImpactNext24h: [],
    dangerZoneActive: bt.calendar.dangerZoneActive,
    dangerZoneMessage: bt.calendar.dangerZoneMessage,
    fetchedAt: date,
  } : null;

  // Macro — map to MacroData shape
  const btm = bt.macro ?? {};
  const makeMI = (key: string) => ({
    symbol: key, name: key,
    price: btm[key]?.price ?? 0,
    change: btm[key]?.change ?? 0,
    changePct: btm[key]?.changePct ?? 0,
    trend: btm[key]?.trend ?? "neutral",
    signal: "",
  });
  const macro: MacroData | null = Object.keys(btm).length ? {
    dxy: makeMI("dxy"), spx: makeMI("spx"), ndx: makeMI("ndx"), vix: makeMI("vix"),
    us10y: makeMI("us10y"), oil: makeMI("oil"), gold: makeMI("gold"), copper: makeMI("copper"),
    usdcnh: makeMI("usdcnh"), dax: makeMI("dax"), ftse: makeMI("ftse"), nikkei: makeMI("nikkei"),
    hyg: makeMI("hyg"), vvix: makeMI("vvix"), skew: makeMI("skew"), smh: makeMI("smh"),
    eem: makeMI("eem"), silver: makeMI("silver"),
    gsRatio: btm.gsRatio ?? 0,
    copperGoldRatio: btm.copperGoldRatio ?? 0,
    currencyStrength: btm.currencyStrength ?? [],
    pairADR: btm.pairADR ?? [],
    riskEnvironment: btm.riskEnvironment ?? "neutral",
    usdBias: btm.usdBias ?? "neutral",
    fetchedAt: date,
  } : null;

  // FRED — map to FredData shape; backtest now stores latestValue on each series
  const btf = bt.fred ?? {};
  const makeSeries = (key: string, id: string) => ({
    id, name: key,
    latestValue: btf[key]?.latestValue ?? btf[key]?.value ?? 0,
    previousValue: btf[key]?.prev ?? 0,
    change: (btf[key]?.value ?? 0) - (btf[key]?.prev ?? 0),
    trend: btf[key]?.trend ?? "flat",
    unit: "%",
    observationDate: btf[key]?.date ?? date,
    interpretation: "",
  });
  const fred: FredData | null = Object.keys(btf).length ? {
    cpi: makeSeries("cpi", "CPIAUCSL"),
    unemployment: makeSeries("unemployment", "UNRATE"),
    fedRate: makeSeries("fedRate", "FEDFUNDS"),
    us2y: makeSeries("us2y", "DGS2"),
    realYield: makeSeries("realYield", "DFII10"),
    walcl: makeSeries("walcl", "WALCL"),
    yieldCurve: btf.yieldCurve ?? { us2y: 0, us10y: 0, spread: 0, inverted: false, signal: "" },
    liquidityRegime: btf.liquidityRegime ?? "neutral",
    centralBankBias: btf.centralBankBias ?? "neutral",
    usdFundamentalBias: btf.usdFundamentalBias ?? "neutral",
    summary: btf.summary ?? `Historical FRED data as of ${date}`,
    fetchedAt: date,
    source: "FRED",
  } : null;

  // COT — backtest now returns full position shape
  const cot: CotData | null = bt.cot?.positions?.length ? {
    positions: bt.cot.positions,
    fetchedAt: bt.cot.fetchedAt ?? date,
    source: "CFTC",
    note: `Historical COT data as of ${date}`,
  } : null;

  // Sentiment — derived from COT + AAII by backtest service
  const sentiment = bt.sentiment ?? null;

  // ML results + regimes — ATR rule-based, built by backtest service
  const mlResults = bt.mlResults?.length ? bt.mlResults : null;
  const regimes   = bt.regimes && Object.keys(bt.regimes).length ? bt.regimes : null;

  // Technical
  let technical: TechnicalData | null = null;
  if (bt.technical) {
    technical = {};
    for (const [pair, ctx] of Object.entries(bt.technical)) {
      // strip internal _dailyCandles before storing in state (large, not needed by UI)
      const { _dailyCandles: _, ...rest } = ctx as any;
      technical[pair] = rest as TechnicalContext;
    }
  }

  return { macro, sentiment, cot, calendar, fred, score, mlResults, regimes, technical };
}

function ErrorCard({ label }: { label: string }) {
  return (
    <div className="rounded-xl border p-4 text-sm"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
      ⚠ Could not load {label}
    </div>
  );
}

export function DashboardClient({ initial }: { initial: LiveData }) {
  const [data, setData] = useState<LiveData>(initial);
  const [date, setDate] = useState<string>(TODAY);
  const [isHistorical, setIsHistorical] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isLive = date === TODAY;

  const loadDate = useCallback((d: string) => {
    setError(null);
    if (d === TODAY) {
      setIsHistorical(false);
      startTransition(async () => {
        const live = await fetchLive().catch(() => initial);
        setData(live);
        setDate(TODAY);
      });
      return;
    }
    setIsHistorical(true);
    setDate(d);
    startTransition(async () => {
      try {
        const hist = await fetchHistorical(d);
        setData(hist);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }, [initial]);

  const nav = (n: number) => loadDate(addTradingDays(date, n));

  const { macro, sentiment, cot, calendar, fred, score, mlResults, regimes, technical } = data;
  const firstPair = score?.pairs?.[0]?.pair ?? "EUR/USD";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b px-6 py-3 flex items-center justify-between"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="text-base font-bold tracking-tight">MacroTrade</span>
          <span className="text-xs px-2 py-0.5 rounded border font-medium"
            style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--bg-base)" }}>
            Swing Dashboard
          </span>
          <a href="/journal" className="text-xs px-3 py-0.5 rounded border font-medium"
            style={{ color: "var(--green)", borderColor: "rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.06)" }}>
            Journal
          </a>
        </div>

        <div className="flex items-center gap-3">
          {/* Date navigator */}
          <div className="flex items-center gap-1.5">
            {/* Jump to first */}
            <button onClick={() => loadDate(MIN_DATE)} disabled={date <= MIN_DATE || isPending}
              title="First available date (2020-01-02)"
              className="text-[10px] px-1.5 py-0.5 rounded border disabled:opacity-30 transition-all"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--bg-base)" }}>
              «
            </button>

            {/* −30d */}
            <button onClick={() => nav(-30)} disabled={date <= MIN_DATE || isPending}
              title="Back 30 days"
              className="text-[10px] px-1.5 py-0.5 rounded border disabled:opacity-30 transition-all"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--bg-base)" }}>
              −30d
            </button>

            {/* −7d */}
            <button onClick={() => nav(-7)} disabled={date <= MIN_DATE || isPending}
              title="Back 7 days"
              className="text-[10px] px-1.5 py-0.5 rounded border disabled:opacity-30 transition-all"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--bg-base)" }}>
              −7d
            </button>

            {/* −1d */}
            <button onClick={() => nav(-1)} disabled={date <= MIN_DATE || isPending}
              title="Previous day"
              className="text-xs px-1.5 py-0.5 rounded border disabled:opacity-30 transition-all"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--bg-base)" }}>
              ‹
            </button>

            {/* Date picker */}
            <input
              type="date" value={date} min={MIN_DATE} max={TODAY}
              onChange={e => e.target.value && loadDate(toWeekday(e.target.value))}
              className="text-xs rounded border px-2 py-0.5 cursor-pointer"
              style={{
                background: isHistorical ? "rgba(168,85,247,0.1)" : "var(--bg-base)",
                borderColor: isHistorical ? "rgba(168,85,247,0.4)" : "var(--border)",
                color: isHistorical ? "#c084fc" : "var(--text-muted)",
              }}
            />

            {/* +1d */}
            <button onClick={() => nav(1)} disabled={isLive || isPending}
              title="Next day"
              className="text-xs px-1.5 py-0.5 rounded border disabled:opacity-30 transition-all"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--bg-base)" }}>
              ›
            </button>

            {/* +7d */}
            <button onClick={() => nav(7)} disabled={isLive || isPending}
              title="Forward 7 days"
              className="text-[10px] px-1.5 py-0.5 rounded border disabled:opacity-30 transition-all"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--bg-base)" }}>
              +7d
            </button>

            {/* +30d */}
            <button onClick={() => nav(30)} disabled={isLive || isPending}
              title="Forward 30 days"
              className="text-[10px] px-1.5 py-0.5 rounded border disabled:opacity-30 transition-all"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--bg-base)" }}>
              +30d
            </button>

            {/* Jump to today / Live */}
            <button onClick={() => loadDate(TODAY)} disabled={isLive || isPending}
              title="Jump to today (live data)"
              className="text-[10px] px-1.5 py-0.5 rounded border disabled:opacity-30 transition-all font-bold"
              style={{
                color: isHistorical ? "#a855f7" : "var(--text-muted)",
                borderColor: isHistorical ? "rgba(168,85,247,0.4)" : "var(--border)",
                background: isHistorical ? "rgba(168,85,247,0.1)" : "var(--bg-base)",
              }}>
              »
            </button>

            {/* Refresh current date (bust cache) */}
            {isHistorical && (
              <button
                onClick={() => {
                  const d = date;
                  startTransition(async () => {
                    try { setData(await fetchHistorical(d, true)); } catch {}
                  });
                }}
                disabled={isPending}
                title="Re-fetch this date (bust cache)"
                className="text-[10px] px-1.5 py-0.5 rounded border disabled:opacity-30 transition-all"
                style={{ color: "#f59e0b", borderColor: "rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.08)" }}>
                ↺
              </button>
            )}
          </div>

          {macro && !isHistorical && (
            <div className="hidden sm:flex items-center gap-3 text-xs num">
              <span style={{ color: "var(--text-muted)" }}>DXY</span>
              <span className={macro.dxy.trend === "bullish" ? "text-emerald-400 font-bold" : macro.dxy.trend === "bearish" ? "text-red-400 font-bold" : "text-slate-400 font-bold"}>
                {macro.dxy.price.toFixed(2)}
              </span>
              <span style={{ color: "var(--text-muted)" }}>VIX</span>
              <span className={macro.vix.price > 25 ? "text-red-400 font-bold" : "text-slate-300 font-bold"}>
                {macro.vix.price.toFixed(1)}
              </span>
            </div>
          )}
          <CopyButton payload={{ snapshot: date, macro, sentiment, cot, calendar, fred, score, mlResults, regimes, technical }} />
        </div>
      </header>

      {/* Historical mode banner */}
      {isHistorical && (
        <div className="px-6 py-2 flex items-center gap-3"
          style={{ background: "rgba(168,85,247,0.08)", borderBottom: "1px solid rgba(168,85,247,0.2)" }}>
          <span className="text-xs font-bold" style={{ color: "#a855f7" }}>
            🕐 Historical mode —
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {new Date(date + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            · Yahoo Finance, FRED & CFTC data reconstructed · Regime gate unavailable · Sentiment unavailable
          </span>
          {isPending && <span className="text-[10px] animate-pulse" style={{ color: "#a855f7" }}>Loading…</span>}
        </div>
      )}

      {error && (
        <div className="mx-6 mt-4 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3 text-sm text-red-400">
          ✗ {error}
        </div>
      )}

      <main className="max-w-400 mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6"
        style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 0.2s" }}>

        {/* ── PRIORITY: the decision cascade ───────────────────────────────
            All pairs, ordered by grade, columns following the backend's
            R4→R1→R2→R3 evaluation flow. This is the first thing on screen. */}
        {/* Стан джерел даних — попереджає, що частині цифр довіряти не можна */}
        {!isHistorical && <HealthBanner />}

        {score && !isHistorical && <FlipAlertBanner score={score} />}

        {score
          ? <CascadeTable data={score} regimes={regimes} />
          : <ErrorCard label="Score data" />}

        {/* ── ВІЗУАЛЬНИЙ БЕКТЕСТ: свічки + історія вердиктів ───────────── */}
        {score && (
          <VerdictChart
            pairs={score.pairs.map((p) => p.pair)}
            defaultPair={firstPair}
          />
        )}

        {/* ── SECONDARY: context, demoted to a collapsible strip ───────── */}
        <ContextStrip macro={macro} fred={fred}>
          {macro ? <MacroBar data={macro} /> : <ErrorCard label="Macro data" />}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {calendar ? <CalendarPanel data={calendar} /> : <ErrorCard label="Calendar" />}
            {fred ? <FredPanel data={fred} /> : <ErrorCard label="FRED fundamentals" />}
            {sentiment ? <SentimentPanel data={sentiment} /> : <ErrorCard label="Sentiment" />}
            {cot ? <CotPanel data={cot} /> : <ErrorCard label="COT data" />}
          </div>
        </ContextStrip>

        {/* ── DRILL-DOWN: full per-pair analysis ───────────────────────── */}
        {mlResults && regimes && (
          <RegimeGatePanelClient mlResults={mlResults} regimes={regimes} defaultPair={firstPair} />
        )}

        {score
          ? <PairSelector data={score} regimes={regimes} technical={technical} />
          : null}

        <footer className="text-center text-[10px] pb-4" style={{ color: "var(--text-muted)" }}>
          {isHistorical
            ? `Historical reconstruction for ${date} — Yahoo Finance · FRED · CFTC COT · Forex Factory calendar · AAII sentiment. Regime gate: ATR rule-based (no KNN historically).`
            : "Data: Yahoo Finance · CFTC COT · FRED · alternative.me — all live. Refreshes every 15 minutes. Not financial advice."}
        </footer>
      </main>
    </div>
  );
}
