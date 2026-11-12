import { api } from "./lib/api";
import { DashboardClient } from "./components/DashboardClient";
import type { TechnicalData, TechnicalContext } from "./lib/types";

async function fetchAll() {
  const [macro, sentiment, cot, calendar, fred, score, mlResults, regimes, technicalRaw] = await Promise.all([
    api.macro().catch(() => null),
    api.sentiment().catch(() => null),
    api.cot().catch(() => null),
    api.calendar().catch(() => null),
    api.fred().catch(() => null),
    api.score().catch(() => null),
    api.ml().catch(() => null),
    api.regimes().catch(() => null),
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/technical`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  let technical: TechnicalData | null = null;
  if (technicalRaw?.pairs) {
    technical = {};
    for (const t of technicalRaw.pairs as TechnicalContext[]) technical[t.pair] = t;
  }

  return { macro, sentiment, cot, calendar, fred, score, mlResults, regimes, technical };
}

export default async function Dashboard() {
  const initial = await fetchAll();
  return <DashboardClient initial={initial} />;
}
