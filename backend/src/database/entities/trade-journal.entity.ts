import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type TradeDirection = 'BUY' | 'SELL';
export type TradeOutcome = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN';
export type TradeGrade = 'A' | 'B' | 'C' | 'WATCH' | 'NO TRADE';

@Entity('trade_journal')
@Index(['pair', 'entryDate'])
export class TradeJournal {
  @PrimaryGeneratedColumn()
  id: number;

  // --- Core trade fields ---
  @Column()
  pair: string;

  @Column({ type: 'varchar' })
  direction: TradeDirection;

  @Column({ type: 'varchar', default: 'OPEN' })
  outcome: TradeOutcome;

  @Column({ type: 'date' })
  entryDate: string;

  @Column({ type: 'date', nullable: true })
  exitDate: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 5 })
  entryPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 5, nullable: true })
  exitPrice: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 5 })
  stopLoss: number;

  @Column({ type: 'decimal', precision: 10, scale: 5 })
  takeProfit: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  riskRewardRatio: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  pnlPips: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  pnlPercent: number | null;

  // Risk in % of account (e.g. 1.0 = 1%) — used to compute real $ drawdown
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  riskPercent: number | null;

  // Duration in hours (entry → exit)
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  durationHours: number | null;

  // --- System snapshot at trade entry ---
  @Column({ type: 'varchar', nullable: true })
  systemGrade: TradeGrade | null;

  @Column({ type: 'int', nullable: true })
  systemScore: number | null;

  @Column({ type: 'int', nullable: true })
  systemMaxScore: number | null;

  @Column({ type: 'varchar', nullable: true })
  systemDirection: string | null;

  @Column({ type: 'jsonb', nullable: true })
  systemKillSwitches: Array<{ name: string; passed: boolean }> | null;

  @Column({ type: 'jsonb', nullable: true })
  systemFactors: Array<{ name: string; score: number; maxScore: number; status: string }> | null;

  // --- Macro context at entry ---
  @Column({ type: 'varchar', nullable: true })
  macroRiskEnv: string | null;

  @Column({ type: 'varchar', nullable: true })
  macroUsdBias: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 3, nullable: true })
  dxyPrice: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  vixPrice: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 3, nullable: true })
  us10yPrice: number | null;

  // --- ML regime at entry ---
  @Column({ type: 'varchar', nullable: true })
  regimeGateDecision: string | null;

  @Column({ type: 'varchar', nullable: true })
  knnRegime: string | null;

  @Column({ type: 'varchar', nullable: true })
  cbBias: string | null;

  @Column({ type: 'varchar', nullable: true })
  liquidityRegime: string | null;

  // --- Technical context ---
  @Column({ type: 'int', nullable: true })
  alignmentScore: number | null;

  @Column({ type: 'varchar', nullable: true })
  trendWeekly: string | null;

  @Column({ type: 'varchar', nullable: true })
  trendDaily: string | null;

  @Column({ type: 'varchar', nullable: true })
  trendH4: string | null;

  @Column({ type: 'varchar', nullable: true })
  trendH1: string | null;

  // --- Journal fields ---
  @Column({ type: 'text', nullable: true })
  entryRationale: string | null;

  @Column({ type: 'text', nullable: true })
  exitNotes: string | null;

  @Column({ type: 'text', nullable: true })
  lessonsLearned: string | null;

  @Column({ type: 'boolean', default: false })
  followedSystem: boolean;

  @Column({ type: 'boolean', default: false })
  overrodeSignal: boolean;

  @Column({ type: 'text', nullable: true })
  overrideReason: string | null;

  @Column({ type: 'int', nullable: true })
  emotionRating: number | null; // 1-5: 1=fear/FOMO, 5=calm/disciplined

  @Column({ type: 'varchar', array: true, default: '{}' })
  tags: string[];

  @Column({ type: 'varchar', nullable: true })
  screenshotUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
