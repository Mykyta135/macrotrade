import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OhlcvCandle } from '../database/entities/ohlcv-candle.entity';
import { DailyVerdict } from '../database/entities/daily-verdict.entity';

export interface ChartCandle {
  time: number;      // unix seconds — формат lightweight-charts
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VerdictBand {
  /** Початок смуги (unix seconds) */
  from: number;
  /** Кінець смуги — включно з останнім днем цього стану */
  to: number;
  direction: 'BUY' | 'SELL' | 'WATCH' | 'NO TRADE';
  /** Куди схилялась система — робить WATCH читабельним ("WATCH → SELL") */
  bias: 'BUY' | 'SELL' | null;
  score: number;
  /** Скільки послідовних днів тривав цей стан */
  days: number;
  blocker: string | null;
  r2Inverted: boolean;
}

export interface ChartData {
  pair: string;
  candles: ChartCandle[];
  bands: VerdictBand[];
  /** Межі, у яких є вердикти — щоб UI показав, де дані закінчуються */
  verdictRange: { from: string; to: string } | null;
}

@Injectable()
export class ChartService {
  constructor(
    @InjectRepository(OhlcvCandle)
    private readonly candleRepo: Repository<OhlcvCandle>,
    @InjectRepository(DailyVerdict)
    private readonly verdictRepo: Repository<DailyVerdict>,
  ) {}

  /**
   * Свічки + вердикти, згорнуті у смуги.
   *
   * Смуги, а не окремі дні: якщо система 12 днів поспіль каже SELL, на графіку
   * це має бути ОДНА червона зона, а не 12 однакових прямокутників. Так одразу
   * видно, скільки тривав режим і чи збігся він із рухом ціни.
   */
  async getChart(pair: string, limit = 400): Promise<ChartData> {
    const candles = await this.candleRepo.find({
      where: { pair, timeframe: 'daily' },
      order: { timestamp: 'DESC' },
      take: limit,
    });
    candles.reverse();

    const verdicts = await this.verdictRepo.find({
      where: { pair },
      order: { date: 'ASC' },
    });

    return {
      pair,
      candles: candles.map((c) => ({
        time: Math.floor(Number(c.timestamp) / 1000),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      })),
      bands: this.buildBands(verdicts),
      verdictRange: verdicts.length
        ? { from: verdicts[0].date, to: verdicts[verdicts.length - 1].date }
        : null,
    };
  }

  /** Згортає послідовні однакові вердикти в одну смугу. */
  private buildBands(verdicts: DailyVerdict[]): VerdictBand[] {
    const bands: VerdictBand[] = [];
    const toSec = (d: string) => Math.floor(new Date(d + 'T00:00:00Z').getTime() / 1000);

    for (const v of verdicts) {
      const last = bands[bands.length - 1];
      const t = toSec(v.date);

      // Продовжуємо смугу, якщо напрямок той самий
      if (last && last.direction === v.direction && last.bias === (v.bias ?? null)) {
        last.to = t;
        last.days++;
        // Показуємо найгірший бал у смузі — консервативніше
        last.score = Math.min(last.score, v.score);
        if (v.blocker && !last.blocker) last.blocker = v.blocker;
        if (v.r2Inverted) last.r2Inverted = true;
        continue;
      }

      bands.push({
        from: t,
        to: t,
        direction: v.direction as VerdictBand['direction'],
        bias: (v.bias as 'BUY' | 'SELL' | null) ?? null,
        score: v.score,
        days: 1,
        blocker: v.blocker,
        r2Inverted: v.r2Inverted,
      });
    }

    return bands;
  }

  async availablePairs(): Promise<string[]> {
    const rows = await this.candleRepo
      .createQueryBuilder('c')
      .select('DISTINCT c.pair', 'pair')
      .where('c.timeframe = :tf', { tf: 'daily' })
      .getRawMany();
    return rows.map((r) => r.pair).sort();
  }
}
