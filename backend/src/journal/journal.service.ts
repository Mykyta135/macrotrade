import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeJournal, TradeOutcome } from '../database/entities/trade-journal.entity';

export interface CreateTradeDto {
  pair: string;
  direction: 'BUY' | 'SELL';
  entryDate: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  // System snapshot
  systemGrade?: string;
  systemScore?: number;
  systemMaxScore?: number;
  systemDirection?: string;
  systemKillSwitches?: Array<{ name: string; passed: boolean }>;
  systemFactors?: Array<{ name: string; score: number; maxScore: number; status: string }>;
  // Macro
  macroRiskEnv?: string;
  macroUsdBias?: string;
  dxyPrice?: number;
  vixPrice?: number;
  us10yPrice?: number;
  // Regime
  regimeGateDecision?: string;
  knnRegime?: string;
  cbBias?: string;
  liquidityRegime?: string;
  // Technical
  alignmentScore?: number;
  trendWeekly?: string;
  trendDaily?: string;
  trendH4?: string;
  trendH1?: string;
  // Journal
  entryRationale?: string;
  followedSystem?: boolean;
  overrodeSignal?: boolean;
  overrideReason?: string;
  emotionRating?: number;
  tags?: string[];
  screenshotUrl?: string;
  riskPercent?: number;
}

export interface UpdateTradeDto {
  exitDate?: string;
  exitPrice?: number;
  outcome?: TradeOutcome;
  pnlPips?: number;
  pnlPercent?: number;
  durationHours?: number;
  exitNotes?: string;
  lessonsLearned?: string;
  followedSystem?: boolean;
  overrodeSignal?: boolean;
  overrideReason?: string;
  emotionRating?: number;
  tags?: string[];
  screenshotUrl?: string;
  entryRationale?: string;
}

export interface JournalStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winRate: number;
  avgRR: number;
  avgPnlPips: number;
  totalPnlPips: number;
  profitFactor: number;
  byGrade: Record<string, { trades: number; wins: number; winRate: number }>;
  byPair: Record<string, { trades: number; wins: number; winRate: number; totalPips: number }>;
  followedSystemWinRate: number;
  overrodeSystemWinRate: number;
  byOutcome: Record<string, number>;
  avgEmotionRating: number;
  longestWinStreak: number;
  longestLossStreak: number;
  recentPerformance: Array<{ date: string; pnlPips: number; outcome: string; rMultiple: number | null }>;
  maxDrawdownPips: number;
  maxDrawdownPct: number | null;
  recoveryFactor: number | null;
  expectancyR: number;
  avgWinPips: number;
  avgLossPips: number;
  avgDurationHours: number | null;
  byDay: Record<string, { trades: number; pnlPips: number; winRate: number }>;
  bySession: Record<string, { trades: number; pnlPips: number; winRate: number }>;
  worstDayPips: number;
  worstDayDate: string | null;
  consecutiveLossesMax: number;
  sharpeEstimate: number | null;
}

@Injectable()
export class JournalService {
  constructor(
    @InjectRepository(TradeJournal)
    private readonly repo: Repository<TradeJournal>,
  ) {}

  async create(dto: CreateTradeDto): Promise<TradeJournal> {
    const rr = this.computeRR(dto.entryPrice, dto.stopLoss, dto.takeProfit, dto.direction);
    const trade = new TradeJournal();
    Object.assign(trade, dto, { riskRewardRatio: rr, outcome: 'OPEN' as const });
    return this.repo.save(trade);
  }

  async findAll(filters?: {
    pair?: string;
    outcome?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ trades: TradeJournal[]; total: number }> {
    const qb = this.repo.createQueryBuilder('t').orderBy('t.entryDate', 'DESC');

    if (filters?.pair) qb.andWhere('t.pair = :pair', { pair: filters.pair });
    if (filters?.outcome) qb.andWhere('t.outcome = :outcome', { outcome: filters.outcome });
    if (filters?.fromDate) qb.andWhere('t.entryDate >= :from', { from: filters.fromDate });
    if (filters?.toDate) qb.andWhere('t.entryDate <= :to', { to: filters.toDate });

    const total = await qb.getCount();
    qb.limit(filters?.limit ?? 50).offset(filters?.offset ?? 0);
    const trades = await qb.getMany();
    return { trades, total };
  }

  async findOne(id: number): Promise<TradeJournal> {
    const trade = await this.repo.findOneBy({ id });
    if (!trade) throw new NotFoundException(`Trade ${id} not found`);
    return trade;
  }

  async update(id: number, dto: UpdateTradeDto): Promise<TradeJournal> {
    const trade = await this.findOne(id);
    Object.assign(trade, dto);
    if (dto.exitPrice && trade.entryPrice && trade.outcome !== 'OPEN') {
      trade.pnlPips = dto.pnlPips ?? null;
      trade.pnlPercent = dto.pnlPercent ?? null;
    }
    return this.repo.save(trade);
  }

  async delete(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  async getStats(): Promise<JournalStats> {
    const all = await this.repo.find({ order: { entryDate: 'ASC' } });
    const closed = all.filter(t => t.outcome !== 'OPEN');
    const wins = closed.filter(t => t.outcome === 'WIN');
    const losses = closed.filter(t => t.outcome === 'LOSS');

    const totalPnl = closed.reduce((s, t) => s + (Number(t.pnlPips) || 0), 0);
    const winPips = wins.reduce((s, t) => s + (Number(t.pnlPips) || 0), 0);
    const lossPips = Math.abs(losses.reduce((s, t) => s + (Number(t.pnlPips) || 0), 0));
    const avgWinPips = wins.length > 0 ? Math.round(winPips / wins.length) : 0;
    const avgLossPips = losses.length > 0 ? Math.round(lossPips / losses.length) : 0;

    // ── Breakdown by grade + pair ─────────────────────────────────────────────
    const byGrade: Record<string, { trades: number; wins: number; winRate: number }> = {};
    const byPair: Record<string, { trades: number; wins: number; winRate: number; totalPips: number }> = {};
    for (const t of closed) {
      const g = t.systemGrade ?? 'UNKNOWN';
      if (!byGrade[g]) byGrade[g] = { trades: 0, wins: 0, winRate: 0 };
      byGrade[g].trades++;
      if (t.outcome === 'WIN') byGrade[g].wins++;

      const p = t.pair;
      if (!byPair[p]) byPair[p] = { trades: 0, wins: 0, winRate: 0, totalPips: 0 };
      byPair[p].trades++;
      if (t.outcome === 'WIN') byPair[p].wins++;
      byPair[p].totalPips += Number(t.pnlPips) || 0;
    }
    for (const g of Object.values(byGrade)) g.winRate = g.trades > 0 ? Math.round((g.wins / g.trades) * 100) : 0;
    for (const p of Object.values(byPair)) p.winRate = p.trades > 0 ? Math.round((p.wins / p.trades) * 100) : 0;

    // ── Streaks ───────────────────────────────────────────────────────────────
    let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0;
    for (const t of closed) {
      if (t.outcome === 'WIN') { curWin++; curLoss = 0; maxWin = Math.max(maxWin, curWin); }
      else if (t.outcome === 'LOSS') { curLoss++; curWin = 0; maxLoss = Math.max(maxLoss, curLoss); }
      else { curWin = 0; curLoss = 0; }
    }

    // ── Max drawdown (peak-to-trough on cumulative pip equity curve) ──────────
    let peak = 0, trough = 0, maxDD = 0, runningPnl = 0;
    for (const t of closed) {
      runningPnl += Number(t.pnlPips) || 0;
      if (runningPnl > peak) { peak = runningPnl; trough = runningPnl; }
      if (runningPnl < trough) {
        trough = runningPnl;
        maxDD = Math.max(maxDD, peak - trough);
      }
    }

    // Max drawdown in % of account (requires riskPercent on each trade)
    // We simulate a $10,000 account applying each trade's riskPercent as the risk unit.
    // A loss = –riskPercent%, a win = riskPercent% × RR
    const tradesWithRisk = closed.filter(t => t.riskPercent != null && t.riskPercent > 0);
    let maxDDPct: number | null = null;
    if (tradesWithRisk.length === closed.length && closed.length > 0) {
      let acc = 10000, peakAcc = 10000, maxDDraw = 0;
      for (const t of closed) {
        const r = Number(t.riskPercent) / 100;
        const rr = Number(t.riskRewardRatio) || 1;
        if (t.outcome === 'WIN') acc *= (1 + r * rr);
        else if (t.outcome === 'LOSS') acc *= (1 - r);
        if (acc > peakAcc) peakAcc = acc;
        const dd = (peakAcc - acc) / peakAcc * 100;
        if (dd > maxDDraw) maxDDraw = dd;
      }
      maxDDPct = Math.round(maxDDraw * 10) / 10;
    }

    // ── Expectancy in R multiples ─────────────────────────────────────────────
    const rMultiples = closed.map(t => {
      const rr = Number(t.riskRewardRatio) || null;
      if (!rr) return null;
      if (t.outcome === 'WIN') return rr;
      if (t.outcome === 'LOSS') return -1;
      return 0;
    });
    const validR = rMultiples.filter((r): r is number => r !== null);
    const expectancyR = validR.length > 0
      ? Math.round((validR.reduce((s, r) => s + r, 0) / validR.length) * 100) / 100
      : 0;

    // ── Sharpe estimate (mean R / std dev R) ──────────────────────────────────
    let sharpeEstimate: number | null = null;
    if (validR.length >= 5) {
      const mean = validR.reduce((s, r) => s + r, 0) / validR.length;
      const variance = validR.reduce((s, r) => s + (r - mean) ** 2, 0) / validR.length;
      const std = Math.sqrt(variance);
      sharpeEstimate = std > 0 ? Math.round((mean / std) * 100) / 100 : null;
    }

    // ── Recovery factor ───────────────────────────────────────────────────────
    const recoveryFactor = maxDD > 0 ? Math.round((totalPnl / maxDD) * 100) / 100 : null;

    // ── By day of week ────────────────────────────────────────────────────────
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const byDay: Record<string, { trades: number; pnlPips: number; wins: number; winRate: number }> = {};
    for (const t of closed) {
      const day = DAYS[new Date(t.entryDate + 'T12:00:00Z').getUTCDay()];
      if (!byDay[day]) byDay[day] = { trades: 0, pnlPips: 0, wins: 0, winRate: 0 };
      byDay[day].trades++;
      byDay[day].pnlPips += Number(t.pnlPips) || 0;
      if (t.outcome === 'WIN') byDay[day].wins++;
    }
    for (const d of Object.values(byDay)) {
      d.pnlPips = Math.round(d.pnlPips);
      d.winRate = d.trades > 0 ? Math.round((d.wins / d.trades) * 100) : 0;
    }

    // ── Worst single calendar day ─────────────────────────────────────────────
    const byDate: Record<string, number> = {};
    for (const t of closed) {
      byDate[t.entryDate] = (byDate[t.entryDate] ?? 0) + (Number(t.pnlPips) || 0);
    }
    let worstDayPips = 0, worstDayDate: string | null = null;
    for (const [date, pips] of Object.entries(byDate)) {
      if (pips < worstDayPips) { worstDayPips = pips; worstDayDate = date; }
    }
    worstDayPips = Math.round(worstDayPips);

    // ── Session breakdown (by entry hour UTC) ─────────────────────────────────
    // Asia: 00–08 UTC, London: 07–15 UTC (overlap 07-08 counts London), NY: 13–22 UTC
    const bySession: Record<string, { trades: number; pnlPips: number; wins: number; winRate: number }> = {
      Asia: { trades: 0, pnlPips: 0, wins: 0, winRate: 0 },
      London: { trades: 0, pnlPips: 0, wins: 0, winRate: 0 },
      'NY': { trades: 0, pnlPips: 0, wins: 0, winRate: 0 },
      Other: { trades: 0, pnlPips: 0, wins: 0, winRate: 0 },
    };
    for (const t of closed) {
      // entryDate is date-only; without exact time we skip session breakdown
      // (only populated if durationHours present and entryDate has time component)
      bySession['Other'].trades++;
      bySession['Other'].pnlPips += Number(t.pnlPips) || 0;
      if (t.outcome === 'WIN') bySession['Other'].wins++;
    }
    for (const s of Object.values(bySession)) {
      s.pnlPips = Math.round(s.pnlPips);
      s.winRate = s.trades > 0 ? Math.round((s.wins / s.trades) * 100) : 0;
    }

    // ── Duration ──────────────────────────────────────────────────────────────
    const durTrades = closed.filter(t => t.durationHours != null);
    const avgDurationHours = durTrades.length > 0
      ? Math.round((durTrades.reduce((s, t) => s + Number(t.durationHours), 0) / durTrades.length) * 10) / 10
      : null;

    // ── Emotion ───────────────────────────────────────────────────────────────
    const emotionTrades = closed.filter(t => t.emotionRating != null);
    const avgEmotion = emotionTrades.length > 0
      ? emotionTrades.reduce((s, t) => s + (t.emotionRating ?? 0), 0) / emotionTrades.length : 0;

    // ── Recent performance ────────────────────────────────────────────────────
    const recent = closed.slice(-20).reverse().map((t, i) => ({
      date: t.entryDate,
      pnlPips: Number(t.pnlPips) || 0,
      outcome: t.outcome,
      rMultiple: rMultiples[closed.length - 1 - i],
    }));

    const followed = closed.filter(t => t.followedSystem);
    const overrode = closed.filter(t => t.overrodeSignal);

    return {
      totalTrades: all.length,
      openTrades: all.filter(t => t.outcome === 'OPEN').length,
      closedTrades: closed.length,
      winRate: closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0,
      avgRR: closed.length > 0
        ? Math.round((closed.reduce((s, t) => s + (Number(t.riskRewardRatio) || 0), 0) / closed.length) * 100) / 100 : 0,
      avgPnlPips: closed.length > 0 ? Math.round(totalPnl / closed.length) : 0,
      totalPnlPips: Math.round(totalPnl),
      profitFactor: lossPips > 0 ? Math.round((winPips / lossPips) * 100) / 100 : winPips > 0 ? 99 : 0,
      byGrade, byPair,
      followedSystemWinRate: followed.length > 0
        ? Math.round((followed.filter(t => t.outcome === 'WIN').length / followed.length) * 100) : 0,
      overrodeSystemWinRate: overrode.length > 0
        ? Math.round((overrode.filter(t => t.outcome === 'WIN').length / overrode.length) * 100) : 0,
      byOutcome: {
        WIN: wins.length,
        LOSS: losses.length,
        BREAKEVEN: closed.filter(t => t.outcome === 'BREAKEVEN').length,
      },
      avgEmotionRating: Math.round(avgEmotion * 10) / 10,
      longestWinStreak: maxWin,
      longestLossStreak: maxLoss,
      recentPerformance: recent,
      maxDrawdownPips: Math.round(maxDD),
      maxDrawdownPct: maxDDPct,
      recoveryFactor,
      expectancyR,
      avgWinPips,
      avgLossPips,
      avgDurationHours,
      byDay,
      bySession,
      worstDayPips,
      worstDayDate,
      consecutiveLossesMax: maxLoss,
      sharpeEstimate,
    };
  }

  private computeRR(entry: number, sl: number, tp: number, dir: string): number | null {
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    if (risk === 0) return null;
    return Math.round((reward / risk) * 100) / 100;
  }
}
