"use client";

import { useState } from "react";
import type { PairScore, ScoreData, RegimeData, KillSwitch, ScoreFactor } from "../lib/types";

/**
 * CascadeTable — the priority decision surface.
 *
 * Renders every pair as one row whose columns follow the backend's actual
 * evaluation order (see backend/src/score/score.service.ts):
 *
 *   R4 veto → R1 macro baseline → R2 lie detector → R3 confluence → verdict
 *
 * That order is causal, not cosmetic: R2 can invert R1's direction, and any
 * failed kill switch downgrades the verdict to WATCH regardless of points.
 * The row reads left-to-right as the reason the verdict came out that way, so
 * the trader never has to read prose to find the blocker.
 *
 * Prose (tradeRecommendation, unlockCondition, factor details) collapses into
 * an expandable drawer — available, but no longer competing with the signal.
 */

const GRADE_ORDER: Record<PairScore["grade"], number> = {
  A: 0, B: 1, C: 2, WATCH: 3, "NO TRADE": 4,
};

// R4 kill switches are the news/panic veto; the rest gate the verdict later.
const R4_SWITCH = "News Clear";

function verdictStyle(dir: PairScore["direction"]) {
  if (dir === "BUY")   return { fg: "#34d399", bg: "rgba(16,185,129,0.10)", bd: "rgba(16,185,129,0.40)", mark: "▲" };
  if (dir === "SELL")  return { fg: "#f87171", bg: "rgba(239,68,68,0.10)",  bd: "rgba(239,68,68,0.40)",  mark: "▼" };
  if (dir === "WATCH") return { fg: "#fbbf24", bg: "rgba(245,158,11,0.10)", bd: "rgba(245,158,11,0.40)", mark: "⚠" };
  return { fg: "#94a3b8", bg: "rgba(100,116,139,0.08)", bd: "rgba(100,116,139,0.30)", mark: "·" };
}

/** Score as 5 discrete pips — readable at a glance, no arithmetic needed. */
function ScorePips({ score, max, dim }: { score: number; max: number; dim: boolean }) {
  const color = dim ? "#64748b" : score >= 4 ? "#34d399" : score >= 3 ? "#60a5fa" : "#f87171";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className="w-1.5 h-3.5 rounded-[1px]"
            style={{ background: i < score ? color : "var(--border)" }}
          />
        ))}
      </div>
      <span className="num text-xs font-bold tabular-nums" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

/** One cascade stage cell: a state glyph plus a terse label. */
function StageCell({
  state,
  label,
  title,
}: {
  state: "pass" | "warn" | "fail" | "idle";
  label: string;
  title?: string;
}) {
  const fg =
    state === "pass" ? "#34d399" :
    state === "warn" ? "#fbbf24" :
    state === "fail" ? "#f87171" : "#64748b";
  const glyph =
    state === "pass" ? "✓" :
    state === "warn" ? "⚠" :
    state === "fail" ? "✗" : "—";

  return (
    <div className="flex items-center gap-1.5 min-w-0" title={title}>
      <span className="font-bold shrink-0" style={{ color: fg }}>{glyph}</span>
      <span className="truncate text-[11px]" style={{ color: state === "idle" ? "#64748b" : "var(--text-secondary)" }}>
        {label}
      </span>
    </div>
  );
}

function r4State(sw: KillSwitch | undefined, dangerZone: boolean) {
  if (dangerZone) return { state: "fail" as const, label: "danger zone" };
  if (!sw) return { state: "idle" as const, label: "—" };
  return sw.passed
    ? { state: "pass" as const, label: "clear" }
    : { state: "fail" as const, label: "news/panic" };
}

/** The blocker is the first failed gate — the single fact that explains the verdict. */
function primaryBlocker(p: PairScore): KillSwitch | null {
  return p.killSwitches.find((k) => !k.passed) ?? null;
}

/**
 * What each gate actually tests, in plain language.
 *
 * The backend's `detail` explains the current *reading* ("US2Y 4.18% rising…"),
 * but not what the gate is *for*. Without that, a green ✓ is unreadable — you
 * see that it passed, not what passing means. Keyed by name prefix because the
 * full names carry parenthetical thresholds.
 */
const GATE_PURPOSE: Array<[string, string]> = [
  ["News Clear",
   "Блокує вхід, якщо високоімпактна новина по одній із валют пари виходить протягом 2 годин, активна danger zone з календаря, або VIX > 30 (режим паніки). Під новину рух непередбачуваний — стопи вибиває шумом."],
  ["US Bond Yields Align",
   "Вимагає, щоб US10Y і US2Y рухались в один бік. 2Y — найшвидший індикатор очікувань щодо ФРС, 10Y — погляд на зростання. Якщо вони розходяться, сигнал по долару неоднозначний, і напрямок пари ненадійний."],
  ["Weekly Trend Aligns",
   "Перевіряє, що тижневий тренд не проти вас. Для пар з USD орієнтир — тренд DXY. Для ризикових валют (AUD, NZD, GBP, CAD) — режим ризику плюс перевірка дивергенції SPX/HYG."],
  ["ADR Not Exhausted",
   "Блокує, якщо сьогоднішній рух пари вже вибрав ≥80% від середнього денного діапазону за 14 днів. «Пальне» на день скінчилось — входити пізно. Скидається на відкритті наступної сесії."],
];

function gatePurpose(name: string): string | null {
  return GATE_PURPOSE.find(([prefix]) => name.startsWith(prefix))?.[1] ?? null;
}

/** Пояснення для tooltip, коли причина не в unlockCondition. */
function whyBlocked(p: PairScore): string | null {
  if (p.dangerZoneBlock) return "Активна danger zone з календаря";
  return p.watchlistReason;
}

/**
 * One gate, expandable.
 *
 * Collapsed it shows pass/fail + name. Expanded it answers the question a bare
 * ✓ cannot: what this gate tests, and what the current numbers are. Previously
 * only *failed* gates explained themselves (via unlockCondition), so a passing
 * cascade was opaque.
 */
function GateRow({ ks }: { ks: KillSwitch }) {
  const [open, setOpen] = useState(false);
  const purpose = gatePurpose(ks.name);

  return (
    <div className="text-[11px]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-start gap-1.5 w-full text-left py-0.5 rounded transition-colors hover:bg-white/3"
      >
        <span className="shrink-0 font-bold" style={{ color: ks.passed ? "#34d399" : "#f87171" }}>
          {ks.passed ? "✓" : "✗"}
        </span>
        <span className="min-w-0 flex-1" style={{ color: ks.passed ? "var(--text-secondary)" : "#f87171" }}>
          {ks.name}
        </span>
        <span className="shrink-0 text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="ml-4 mt-1 mb-1.5 pl-2.5 flex flex-col gap-1.5"
          style={{ borderLeft: `2px solid ${ks.passed ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}` }}>

          {/* Що цей фільтр перевіряє */}
          {purpose && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>
                Що перевіряє
              </p>
              <p className="leading-relaxed" style={{ color: "var(--text-muted)" }}>{purpose}</p>
            </div>
          )}

          {/* Поточні показники — конкретні цифри, а не просто галочка */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>
              {ks.passed ? "Чому відкритий" : "Чому заблоковано"}
            </p>
            <p className="leading-relaxed" style={{ color: ks.passed ? "#6ee7b7" : "#fca5a5" }}>
              {ks.detail}
            </p>
          </div>

          {/* Умова розблокування — лише для провалених */}
          {!ks.passed && ks.unlockCondition && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>
                Чого чекати
              </p>
              <p className="leading-relaxed" style={{ color: "#fbbf24" }}>{ks.unlockCondition}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Що дає бали кожен фактор — так само не виводиться з самої назви. */
const FACTOR_PURPOSE: Array<[string, string]> = [
  ["Retail Sentiment",
   "Торгівля проти натовпу. 2 бали, якщо >70% роздрібу стоїть проти вашого напрямку, 1 бал при 60–70%. Джерело — незвітні позиції CFTC (реальні дрібні трейдери)."],
  ["COT Report",
   "Позиціонування хедж-фондів. 2 бали, якщо інституціонали на вашому боці, 0 — якщо проти. Дані CFTC оновлюються щоп'ятниці зі станом на вівторок."],
  ["Correlated Pairs",
   "Підтвердження від пов'язаних ринків: сила валютних ETF обох ніг, сировина (нафта→CAD, золото+мідь→AUD/NZD), індекси. 1 бал, якщо більшість перевірок підтверджують напрямок."],
];

function FactorRow({ f }: { f: ScoreFactor }) {
  const [open, setOpen] = useState(false);
  const purpose = FACTOR_PURPOSE.find(([p]) => f.name.startsWith(p))?.[1] ?? null;
  const color = f.status === "pass" ? "#34d399" : f.status === "warn" ? "#fbbf24" : "#f87171";

  return (
    <div className="text-[11px]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-start justify-between gap-2 w-full text-left py-0.5 rounded transition-colors hover:bg-white/3"
      >
        <span className="min-w-0 flex-1" style={{ color: "var(--text-secondary)" }}>
          <span className="font-bold mr-1" style={{ color }}>
            {f.status === "pass" ? "✓" : f.status === "warn" ? "⚠" : "✗"}
          </span>
          {f.name}
        </span>
        <span className="num shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
          {f.score}/{f.maxScore}
        </span>
        <span className="shrink-0 text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="ml-4 mt-1 mb-1.5 pl-2.5 flex flex-col gap-1.5"
          style={{ borderLeft: `2px solid ${color}4d` }}>
          {purpose && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>
                Як нараховуються бали
              </p>
              <p className="leading-relaxed" style={{ color: "var(--text-muted)" }}>{purpose}</p>
            </div>
          )}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>
              Поточний стан
            </p>
            <p className="leading-relaxed" style={{ color }}>{f.detail}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  p,
  expanded,
  onToggle,
  gate,
}: {
  p: PairScore;
  expanded: boolean;
  onToggle: () => void;
  gate?: string;
}) {
  const v = verdictStyle(p.direction);
  const blocker = primaryBlocker(p);
  const r4 = r4State(p.killSwitches.find((k) => k.name.startsWith(R4_SWITCH)), p.dangerZoneBlock);
  const halted = p.factors.length === 0;

  // R2 has three meaningful states: silent, warned, or actually inverted.
  const r2Inverted = p.r2InversionNote?.includes("INVERSION") ?? false;
  const r2Warned = !r2Inverted && !!p.r2InversionNote;

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors border-t"
        style={{ borderColor: "var(--border)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(148,163,184,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {/* Pair */}
        <td className="py-2.5 pl-3 pr-2 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] w-2 shrink-0" style={{ color: "var(--text-muted)" }}>
              {expanded ? "▾" : "▸"}
            </span>
            <span className="font-bold text-sm">{p.pair}</span>
            {p.liquidityTrapWarning && <span className="text-[10px]" title="Liquidity trap detected">🧲</span>}
            {gate && gate !== "NORMAL" && (
              <span className="text-[8px] font-bold px-1 rounded border"
                style={{ color: "#a855f7", borderColor: "rgba(168,85,247,0.4)", background: "rgba(168,85,247,0.1)" }}>
                {gate}
              </span>
            )}
          </div>
        </td>

        {/* R4 — execution veto */}
        <td className="py-2.5 px-2"><StageCell state={r4.state} label={r4.label} /></td>

        {/* R1 — macro baseline direction */}
        <td className="py-2.5 px-2">
          <span className="text-[11px] font-semibold num"
            style={{ color: p.direction === "NO TRADE" ? "#64748b" : "var(--text-primary)" }}>
            {halted ? "—" : p.direction === "WATCH" || p.direction === "NO TRADE"
              ? (p.tradeRecommendation.match(/for (BUY|SELL)/)?.[1] ?? "—")
              : p.direction}
          </span>
        </td>

        {/* R2 — lie detector */}
        <td className="py-2.5 px-2">
          <StageCell
            state={r2Inverted ? "fail" : r2Warned ? "warn" : "pass"}
            label={r2Inverted ? "inverted" : r2Warned ? "divergence" : "confirms"}
            title={p.r2InversionNote ?? undefined}
          />
        </td>

        {/* R3 — confluence points */}
        <td className="py-2.5 px-2">
          <ScorePips score={p.totalScore} max={p.maxScore} dim={p.direction === "NO TRADE"} />
        </td>

        {/* Verdict */}
        <td className="py-2.5 px-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-bold whitespace-nowrap"
            style={{ color: v.fg, background: v.bg, borderColor: v.bd }}>
            <span>{v.mark}</span>{p.direction}
          </span>
        </td>

        {/* Blocker — the one fact that explains a non-trade verdict */}
        <td className="py-2.5 pl-2 pr-3 max-w-0">
          {blocker ? (
            <span className="block truncate text-[11px]" style={{ color: "#fbbf24" }} title={blocker.unlockCondition ?? whyBlocked(p) ?? blocker.detail}>
              {blocker.name.replace(/\s*\(.*\)$/, "")}
            </span>
          ) : p.direction === "NO TRADE" ? (
            // Gates усі пройдені, але балів забракло — інакше «all gates clear»
            // поруч із NO TRADE виглядає як суперечність
            <span className="block truncate text-[11px]" style={{ color: "#94a3b8" }}
              title={`Потрібно ≥3 бали, набрано ${p.totalScore}`}>
              мало балів ({p.totalScore}/5)
            </span>
          ) : (
            <span className="text-[11px]" style={{ color: "#34d399" }}>all gates clear</span>
          )}
        </td>
      </tr>

      {/* Drawer — the prose, on demand */}
      {expanded && (
        <tr style={{ background: "var(--bg-base)" }}>
          <td colSpan={7} className="px-4 py-3">
            <div className="flex flex-col gap-3">
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {p.tradeRecommendation}
              </p>

              {p.r2InversionNote && (
                <p className="text-[11px] leading-relaxed rounded border px-2.5 py-2"
                  style={{ color: "#93c5fd", borderColor: "rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.07)" }}>
                  {p.r2InversionNote}
                </p>
              )}

              {p.liquidityTrapWarning && (
                <p className="text-[11px] leading-relaxed rounded border px-2.5 py-2"
                  style={{ color: "#d8b4fe", borderColor: "rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.07)" }}>
                  {p.liquidityTrapWarning}
                </p>
              )}

              {/* Gates + factors side by side — the full cascade detail */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>
                    Gates
                  </p>
                  {p.killSwitches.map((k, i) => (
                    <GateRow key={i} ks={k} />
                  ))}
                </div>

                <div className="flex flex-col gap-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>
                    Confluence
                  </p>
                  {p.factors.length === 0 ? (
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Scoring skipped — halted by R4 veto.
                    </span>
                  ) : p.factors.map((f, i) => (
                    <FactorRow key={i} f={f} />
                  ))}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function CascadeTable({
  data,
  regimes,
}: {
  data: ScoreData;
  regimes: RegimeData | null;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const sorted = [...data.pairs].sort(
    (a, b) => GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade] || b.totalScore - a.totalScore,
  );

  const th = "text-[9px] font-bold uppercase tracking-wider py-2 px-2 text-left whitespace-nowrap";

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>

      {/* Danger zone stays loud — it overrides every row below it */}
      {data.dangerZoneActive && (
        <div className="px-4 py-2 flex items-center gap-2 border-b"
          style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}>
          <span>🚨</span>
          <span className="text-xs font-semibold" style={{ color: "#f87171" }}>{data.dangerZoneMessage}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-200">
          <thead>
            <tr style={{ background: "var(--bg-base)", color: "var(--text-muted)" }}>
              <th className={th + " pl-3"}>Pair</th>
              <th className={th}>R4 · Veto</th>
              <th className={th}>R1 · Macro</th>
              <th className={th}>R2 · Lie Detector</th>
              <th className={th}>R3 · Confluence</th>
              <th className={th}>Verdict</th>
              <th className={th + " pr-3"}>Blocker</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <Row
                key={p.pair}
                p={p}
                expanded={open === p.pair}
                onToggle={() => setOpen(open === p.pair ? null : p.pair)}
                gate={regimes?.[p.pair]?.layer1RegimeGate?.gateDecision}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-3 py-1.5 border-t text-[10px]"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        Evaluation flows left to right — a failure at any stage caps the verdict downstream. Click a row for detail.
      </div>
    </div>
  );
}
