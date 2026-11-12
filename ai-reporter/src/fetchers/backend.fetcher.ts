import axios from 'axios';
import { config } from '../config';
import type { BackendContext, ScoreData, MacroData, FredData, SentimentData, CotData, CalendarData, TechnicalReport, MlRegimeResult, RegimePayload } from '../types';

async function fetchEndpoint<T>(path: string): Promise<T | null> {
  try {
    const response = await axios.get<T>(`${config.backendUrl}${path}`, { timeout: 15000 });
    return response.data;
  } catch (error) {
    console.warn(`Failed to fetch ${path}:`, (error as any).message);
    return null;
  }
}

async function fetchRegimePayloads(
  score: ScoreData | null,
  macro: MacroData | null,
  fred: FredData | null,
  sentiment: SentimentData | null,
  calendar: CalendarData | null,
): Promise<Record<string, RegimePayload> | null> {
  // Build query params from available context so the backend can assemble
  // the full Decision Matrix payload per pair with all fundamental inputs
  const pairs = score?.pairs ?? [];
  if (pairs.length === 0) return fetchEndpoint<Record<string, RegimePayload>>('/ml/regime/all');

  const results = await Promise.all(
    pairs.map(async (p) => {
      const sentimentForPair = sentiment?.pairs?.find(s => s.symbol === p.pair.replace('/', ''));
      const params = new URLSearchParams({
        systemDirection: p.direction,
        cbBias: fred?.centralBankBias ?? '',
        liquidityRegime: fred?.liquidityRegime ?? '',
        realYieldTrend: fred?.realYield?.trend ?? '',
        dangerZoneActive: String(calendar?.dangerZoneActive ?? false),
        retailLongPct: String(sentimentForPair?.longPct ?? ''),
        retailSignal: sentimentForPair?.signal ?? '',
      });
      const pairSlug = p.pair.replace('/', '_');
      return fetchEndpoint<RegimePayload>(`/ml/regime/${pairSlug}?${params}`);
    }),
  );

  const out: Record<string, RegimePayload> = {};
  pairs.forEach((p, i) => {
    if (results[i]) out[p.pair] = results[i]!;
  });
  return Object.keys(out).length > 0 ? out : null;
}

export async function fetchBackendContext(): Promise<BackendContext> {
  // First wave — all independent endpoints in parallel
  const [score, macro, fred, sentiment, cot, calendar, technical, ml] = await Promise.all([
    fetchEndpoint<ScoreData>('/score'),
    fetchEndpoint<MacroData>('/macro'),
    fetchEndpoint<FredData>('/fred'),
    fetchEndpoint<SentimentData>('/sentiment'),
    fetchEndpoint<CotData>('/cot'),
    fetchEndpoint<CalendarData>('/calendar'),
    fetchEndpoint<TechnicalReport>('/technical'),
    fetchEndpoint<MlRegimeResult[]>('/ml'),
  ]);

  // Second wave — regime payloads depend on score + fred + sentiment + calendar
  const regimePayloads = await fetchRegimePayloads(score, macro, fred, sentiment, calendar);

  return { score, macro, fred, sentiment, cot, calendar, technical, ml, regimePayloads };
}
