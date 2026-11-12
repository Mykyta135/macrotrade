import type { MacroData, SentimentData, CotData, CalendarData, FredData, ScoreData, MlResult, RegimeData, TechnicalData, TechnicalContext, TradeJournal, JournalListResponse, JournalStats, CreateTradePayload, UpdateTradePayload } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

async function get<T>(path: string, cache: RequestCache = "no-store"): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API POST ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API PATCH ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", cache: "no-store" });
  if (!res.ok) throw new Error(`API DELETE ${path} → ${res.status}`);
}

export const journal = {
  list: (params?: { pair?: string; outcome?: string; from?: string; to?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.pair) qs.set("pair", params.pair);
    if (params?.outcome) qs.set("outcome", params.outcome);
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return get<JournalListResponse>(`/journal${q ? `?${q}` : ""}`);
  },
  stats: () => get<JournalStats>("/journal/stats"),
  get: (id: number) => get<TradeJournal>(`/journal/${id}`),
  create: (dto: CreateTradePayload) => post<TradeJournal>("/journal", dto),
  update: (id: number, dto: UpdateTradePayload) => patch<TradeJournal>(`/journal/${id}`, dto),
  delete: (id: number) => del(`/journal/${id}`),
};

export const api = {
  macro: () => get<MacroData>("/macro"),
  sentiment: () => get<SentimentData>("/sentiment"),
  cot: () => get<CotData>("/cot"),
  calendar: () => get<CalendarData>("/calendar"),
  fred: () => get<FredData>("/fred"),
  score: () => get<ScoreData>("/score"),
  ml: () => get<MlResult[]>("/ml"),
  regimes: () => get<RegimeData>("/ml/regime/all"),
  // Backend returns { generatedAt, pairs: TechnicalContext[] } — transform to keyed object
  technical: () =>
    get<{ generatedAt: string; pairs: TechnicalContext[] }>("/technical").then((r) => {
      const out: TechnicalData = {};
      for (const t of r.pairs) out[t.pair] = t;
      return out;
    }),
};
