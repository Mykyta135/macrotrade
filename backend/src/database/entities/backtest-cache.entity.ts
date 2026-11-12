import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('backtest_cache')
export class BacktestCache {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'jsonb' })
  result: object;

  @CreateDateColumn()
  cachedAt: Date;
}
