"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

/**
 * VerdictChart — візуальний бектест.
 *
 * Показує свічки з накладеними смугами вердиктів системи: зелена смуга =
 * система казала BUY у ці дні, червона = SELL, бурштинова = WATCH, сіра =
 * NO TRADE. Гортаючи графік, видно одразу: чи справді зелені зони передували
 * зростанню, а червоні — падінню.
 *
 * Чому це чесніша перевірка за автоматичний бектест: ви бачите ВСЕ, включно
 * з випадками, які автотест приховав би за середніми цифрами. І минуле не
 * можна підігнати під себе — воно вже сталося.
 *
 * lightweight-charts v5: API змінився — addSeries(CandlestickSeries) замість
 * addCandlestickSeries(). Смуги малюються через окрему canvas-накладку, бо
 * вбудованих "зон по осі часу" в бібліотеці немає.
 */

interface Band {
  from: number;
  to: number;
  direction: "BUY" | "SELL" | "WATCH" | "NO TRADE";
  bias: "BUY" | "SELL" | null;
  score: number;
  days: number;
  blocker: string | null;
  r2Inverted: boolean;
}

interface ChartData {
  pair: string;
  candles: { time: number; open: number; high: number; low: number; close: number }[];
  bands: Band[];
  verdictRange: { from: string; to: string } | null;
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3901/api";

// Непрозорість підібрана так, щоб КОЖНА смуга була видима на темному фоні.
// Було: NO TRADE 0.08 — на практиці зливався з фоном і виглядав як "зон немає".
const BAND_COLOR: Record<Band["direction"], string> = {
  BUY: "rgba(16,185,129,0.20)",
  SELL: "rgba(239,68,68,0.20)",
  WATCH: "rgba(245,158,11,0.16)",
  "NO TRADE": "rgba(100,116,139,0.20)",
};

const LABEL_COLOR: Record<Band["direction"], string> = {
  BUY: "#34d399",
  SELL: "#f87171",
  WATCH: "#fbbf24",
  "NO TRADE": "#64748b",
};

/** Індекс найближчої свічки до заданого часу. */
function binarySearch(arr: number[], t: number): number {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] === t) return mid;
    if (arr[mid] < t) lo = mid + 1; else hi = mid - 1;
  }
  return Math.max(0, Math.min(arr.length - 1, lo));
}

export function VerdictChart({ pairs, defaultPair }: { pairs: string[]; defaultPair?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const bandsRef = useRef<Band[]>([]);
  const candleTimesRef = useRef<number[]>([]);
  /**
   * visible через ref, а не лише через state: drawBands викликається з
   * підписок, створених у useEffect([]), які назавжди захопили ПЕРШИЙ рендер.
   * Без ref фільтри смуг не діяли б до наступного перемонтування.
   */
  const visibleRef = useRef<Record<Band["direction"], boolean>>({
    BUY: true, SELL: true, WATCH: true, "NO TRADE": true,
  });

  const [pair, setPair] = useState(defaultPair ?? pairs[0] ?? "EUR/USD");
  const [data, setData] = useState<ChartData | null>(null);
  const [hover, setHover] = useState<Band | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState<Record<Band["direction"], boolean>>({
    BUY: true, SELL: true, WATCH: true, "NO TRADE": true,
  });

  // ── Завантаження даних ────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`${BASE}/chart/${pair.replace("/", "")}?limit=2000`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ChartData | null) => {
        if (!alive) return;
        setData(d);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [pair]);

  // ── Створення графіка ─────────────────────────────────────────────────
  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.06)" },
        horzLines: { color: "rgba(148,163,184,0.06)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      timeScale: {
        borderColor: "rgba(148,163,184,0.15)",
        rightOffset: 8,
        // Гортання як у TradingView
        rightBarStaysOnScroll: true,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "rgba(16,185,129,0.6)",
      wickDownColor: "rgba(239,68,68,0.6)",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Перемальовуємо смуги при будь-якій зміні видимого діапазону
    const redraw = () => drawBands();
    chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);

    // Підказка про смугу під курсором
    chart.subscribeCrosshairMove((param) => {
      const t = param.time as number | undefined;
      if (!t) { setHover(null); return; }
      setHover(bandsRef.current.find((b) => t >= b.from && t <= b.to) ?? null);
    });

    const ro = new ResizeObserver(redraw);
    ro.observe(wrapRef.current);

    return () => {
      ro.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(redraw);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // ── Дані у графік ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || !data) return;
    seriesRef.current.setData(
      data.candles.map((c) => ({ ...c, time: c.time as Time })),
    );
    bandsRef.current = data.bands;
    candleTimesRef.current = data.candles.map((c) => c.time);
    chartRef.current?.timeScale().fitContent();
    // requestAnimationFrame: fitContent() застосовує масштаб асинхронно,
    // без цього timeToCoordinate() рахує по старому діапазону
    requestAnimationFrame(() => drawBands());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Фільтри смуг — оновлюємо ref і перемальовуємо
  useEffect(() => {
    visibleRef.current = visible;
    drawBands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /**
   * Малює смуги вердиктів на canvas поверх графіка.
   *
   * Бібліотека не має "зон по осі часу", тому переводимо час у координати
   * через timeScale().timeToCoordinate() і малюємо прямокутники самі.
   */
  function drawBands() {
    const canvas = overlayRef.current;
    const chart = chartRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !chart || !wrap) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const ts = chart.timeScale();

    /**
     * timeToCoordinate() повертає null для часу, якого немає в даних серії
     * (вихідні, свята) АБО поза видимим діапазоном. Раніше через це смуги
     * не малювались узагалі: у смуги, що починається в суботу, x1 = null,
     * і вся смуга відкидалась.
     *
     * Тому переводимо межі смуги в логічні індекси через найближчу відому
     * свічку, а не покладаємось на точний збіг timestamp.
     */
    const times = candleTimesRef.current;
    const coordOf = (t: number, dir: 1 | -1): number | null => {
      let x = ts.timeToCoordinate(t as Time);
      if (x !== null) return x;
      // Шукаємо найближчу свічку в потрібному напрямку
      let i = binarySearch(times, t);
      for (let step = 0; step < 8 && i >= 0 && i < times.length; step++) {
        x = ts.timeToCoordinate(times[i] as Time);
        if (x !== null) return x;
        i += dir;
      }
      return null;
    };

    for (const b of bandsRef.current) {
      if (!visibleRef.current[b.direction]) continue;

      const x1 = coordOf(b.from, 1);
      const x2 = coordOf(b.to, -1);
      if (x1 === null || x2 === null) continue;

      // Смуга може виходити за межі екрана — обрізаємо
      const left = Math.max(0, Math.min(x1, x2));
      const right = Math.min(w, Math.max(x1, x2));
      if (right < 0 || left > w) continue;

      // Один день має ненульову ширину, інакше смуга невидима
      const width = Math.max(right - left, 2);

      ctx.fillStyle = BAND_COLOR[b.direction];
      ctx.fillRect(left, 0, width, h);

      // Верхня смужка кольору напрямку — видно навіть на вузьких зонах
      ctx.fillStyle = LABEL_COLOR[b.direction];
      ctx.globalAlpha = 0.55;
      ctx.fillRect(left, 0, width, 3);
      ctx.globalAlpha = 1;

      // Підпис, коли смуга достатньо широка. Для WATCH показуємо, куди
      // схилялась система — інакше "WATCH" не каже нічого про напрямок.
      if (width > 46) {
        const label =
          b.direction === "WATCH" && b.bias ? `WATCH→${b.bias} ${b.score}`
          : b.direction === "NO TRADE" ? `— ${b.score}`
          : `${b.direction} ${b.score}`;
        ctx.fillStyle = LABEL_COLOR[b.direction];
        ctx.font = "bold 9px ui-sans-serif, system-ui";
        ctx.fillText(label, left + 4, 14);
      }
    }
  }

  const stats = data?.bands.reduce(
    (acc, b) => {
      acc[b.direction] = (acc[b.direction] ?? 0) + b.days;
      return acc;
    },
    {} as Record<string, number>,
  );
  const totalDays = Object.values(stats ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>

      {/* Панель керування */}
      <div className="flex items-center gap-3 px-3 py-2 border-b flex-wrap"
        style={{ borderColor: "var(--border)" }}>
        <span className="text-[9px] font-bold uppercase tracking-wider shrink-0"
          style={{ color: "var(--text-muted)" }}>
          Візуальний бектест
        </span>

        <select
          value={pair}
          onChange={(e) => setPair(e.target.value)}
          className="text-xs rounded border px-2 py-0.5 cursor-pointer"
          style={{ background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          {pairs.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Фільтри смуг — клік вимикає тип вердикту */}
        <div className="flex items-center gap-1.5">
          {(["BUY", "SELL", "WATCH", "NO TRADE"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setVisible((v) => ({ ...v, [d]: !v[d] }))}
              className="text-[10px] px-1.5 py-0.5 rounded border transition-opacity"
              style={{
                color: LABEL_COLOR[d],
                borderColor: `${LABEL_COLOR[d]}55`,
                background: visible[d] ? `${LABEL_COLOR[d]}18` : "transparent",
                opacity: visible[d] ? 1 : 0.35,
              }}
              title={visible[d] ? "Сховати" : "Показати"}
            >
              {d}
              {stats?.[d] ? ` ${Math.round((stats[d] / totalDays) * 100)}%` : ""}
            </button>
          ))}
        </div>

        {/* Підказка про смугу під курсором */}
        <div className="ml-auto text-[10px] min-w-0 truncate" style={{ color: "var(--text-muted)" }}>
          {hover ? (
            <>
              <span style={{ color: LABEL_COLOR[hover.direction], fontWeight: 700 }}>
                {hover.direction}
              </span>
              {hover.direction === "WATCH" && hover.bias ? ` → ${hover.bias}` : ""}
              {` ${hover.score}/5 · ${hover.days} дн.`}
              {hover.r2Inverted && " · R2 інверсія"}
              {hover.blocker && ` · блокер: ${hover.blocker.replace(/\s*\(.*\)$/, "")}`}
            </>
          ) : loading ? "завантаження…"
            : data?.verdictRange
              ? `вердикти: ${data.verdictRange.from} → ${data.verdictRange.to}`
              : "вердиктів немає — запустіть build-verdict-history.ts"}
        </div>
      </div>

      {/* Графік + накладка зі смугами */}
      <div className="relative" style={{ height: 420 }}>
        <div ref={wrapRef} className="absolute inset-0" />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1 }}
        />
      </div>

      <div className="px-3 py-1.5 border-t text-[10px]"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        Кольорові смуги — вердикт системи в ті дні. Гортайте графік і дивіться, чи
        передували зелені смуги зростанню, а червоні — падінню.
      </div>
    </div>
  );
}
