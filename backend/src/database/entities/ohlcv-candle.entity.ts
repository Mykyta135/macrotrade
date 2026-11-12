import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity('ohlcv_candles')
@Index(['pair', 'timeframe', 'timestamp'], { unique: true })
export class OhlcvCandle {
  @PrimaryColumn()
  pair: string;

  @PrimaryColumn()
  timeframe: string;

  @PrimaryColumn('bigint')
  timestamp: number;

  @Column('double precision')
  open: number;

  @Column('double precision')
  high: number;

  @Column('double precision')
  low: number;

  @Column('double precision')
  close: number;

  @Column('double precision')
  volume: number;
}
