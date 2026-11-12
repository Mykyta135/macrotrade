import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { CacheService } from '../common/cache.service';

export type EventImpact = 'High' | 'Medium' | 'Low';

export interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: EventImpact;
  forecast: string;
  previous: string;
  isUpcoming: boolean;
  minutesUntil: number | null;
  warning: string | null;
}

export interface CalendarData {
  events: CalendarEvent[];
  highImpactNext24h: CalendarEvent[];
  dangerZoneActive: boolean;
  dangerZoneMessage: string | null;
  fetchedAt: string;
}

// Raw event shape — only static fields, no time-computed ones
interface RawEvent {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: EventImpact;
  forecast: string;
  previous: string;
}

const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';

// Forex Factory states the file updates once per hour and rate-limits (429) if you
// request it more frequently. Cache for exactly 1 hour to stay within their limit.
const RAW_CACHE_TTL = 60 * 60;

const COUNTRY_PAIRS: Record<string, string[]> = {
  USD: ['EUR/USD', 'GBP/USD', 'AUD/USD', 'NZD/USD', 'USD/JPY', 'USD/CHF', 'USD/CAD'],
  EUR: ['EUR/USD', 'EUR/JPY', 'EUR/GBP'],
  GBP: ['GBP/USD', 'GBP/JPY', 'EUR/GBP'],
  JPY: ['USD/JPY', 'GBP/JPY', 'EUR/JPY'],
  AUD: ['AUD/USD', 'AUD/JPY'],
  NZD: ['NZD/USD'],
  CAD: ['USD/CAD', 'CAD/JPY'],
  CHF: ['USD/CHF', 'EUR/CHF'],
};

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(private readonly cache: CacheService) {}

  async getCalendarData(): Promise<CalendarData> {
    // Step 1: get raw events (cached for 4h — only re-fetches from Forex Factory rarely)
    const rawEvents = await this.getRawEvents();

    // Step 2: recompute all time-sensitive fields NOW (never cached)
    const now = new Date();
    const events = rawEvents.map((e) => this.applyTime(e, now));

    const highImpact = events.filter((e) => e.impact === 'High');

    const highImpactNext24h = highImpact.filter(
      (e) => e.minutesUntil !== null && e.minutesUntil >= 0 && e.minutesUntil <= 24 * 60,
    );

    const dangerZoneEvent = highImpact.find(
      (e) => e.minutesUntil !== null && e.minutesUntil >= -30 && e.minutesUntil <= 30,
    );

    return {
      events: events.filter((e) => e.impact === 'High' || e.impact === 'Medium'),
      highImpactNext24h,
      dangerZoneActive: !!dangerZoneEvent,
      dangerZoneMessage: dangerZoneEvent
        ? `DANGER ZONE: "${dangerZoneEvent.title}" (${dangerZoneEvent.country}) is within 30 minutes. DO NOT enter trades on ${COUNTRY_PAIRS[dangerZoneEvent.country]?.join(', ') ?? 'affected pairs'}.`
        : null,
      fetchedAt: new Date().toISOString(),
    };
  }

  // Fetch and parse the XML — cached for 1h (Forex Factory's stated update frequency).
  // On 429: honour the Retry-After header and extend the existing cache TTL instead
  // of crashing — the last known events are better than an error.
  private async getRawEvents(): Promise<RawEvent[]> {
    const cached = this.cache.get<RawEvent[]>('calendar_raw');
    if (cached) return cached;

    const response = await axios.get(FF_URL, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      // Don't throw on 4xx so we can inspect the status ourselves
      validateStatus: () => true,
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers['retry-after'] ?? '300', 10);
      this.logger.warn(`Forex Factory 429 — rate limited. Retry-After: ${retryAfter}s. Serving stale cache.`);
      // Re-cache the empty array for the retry-after window so we don't hammer them
      const stale = this.cache.get<RawEvent[]>('calendar_raw_stale') ?? [];
      this.cache.set('calendar_raw', stale, retryAfter);
      return stale;
    }

    if (response.status !== 200) {
      throw new Error(`Forex Factory returned HTTP ${response.status}`);
    }

    const parsed = await parseStringPromise(response.data, { explicitArray: false });
    const rawArr = parsed?.weeklyevents?.event ?? [];
    const eventsArr: any[] = Array.isArray(rawArr) ? rawArr : [rawArr];

    const events: RawEvent[] = eventsArr.map((e) => ({
      title: e.title ?? '',
      country: e.country ?? '',
      date: e.date ?? '',
      time: e.time ?? '',
      impact: this.mapImpact(e.impact ?? ''),
      forecast: e.forecast ?? '',
      previous: e.previous ?? '',
    }));

    // Keep a longer-lived stale copy as fallback for future 429s
    this.cache.set('calendar_raw_stale', events, 7 * 24 * 60 * 60);
    this.cache.set('calendar_raw', events, RAW_CACHE_TTL);
    this.logger.log(`Calendar: fetched ${events.length} events from Forex Factory`);
    return events;
  }

  // Apply current time to a raw event — called on every request, never cached
  private applyTime(e: RawEvent, now: Date): CalendarEvent {
    let minutesUntil: number | null = null;
    let isUpcoming = false;

    try {
      if (e.date && e.time && e.time !== 'All Day') {
        const eventDate = new Date(`${e.date} ${e.time}`);
        minutesUntil = Math.round((eventDate.getTime() - now.getTime()) / 60000);
        isUpcoming = minutesUntil > 0;
      }
    } catch {
      // malformed date — leave null
    }

    const warning =
      e.impact === 'High' &&
      minutesUntil !== null &&
      minutesUntil >= 0 &&
      minutesUntil <= 60
        ? `High-impact "${e.title}" in ${minutesUntil} min. Avoid trades on ${COUNTRY_PAIRS[e.country]?.join(', ') ?? e.country + ' pairs'}.`
        : null;

    return { ...e, isUpcoming, minutesUntil, warning };
  }

  private mapImpact(raw: string): EventImpact {
    const lower = raw.toLowerCase();
    if (lower.includes('high') || lower === '3') return 'High';
    if (lower.includes('medium') || lower === 'moderate' || lower === '2') return 'Medium';
    return 'Low';
  }
}
