import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';

@Entity('technical_snapshots')
@Index(['pair', 'computedAt'])
export class TechnicalSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  pair: string;

  @CreateDateColumn()
  computedAt: Date;

  @Column({ nullable: true })
  trendWeekly: string;

  @Column({ nullable: true })
  trendDaily: string;

  @Column({ nullable: true })
  trendH4: string;

  @Column({ nullable: true })
  trendH1: string;

  @Column('int', { nullable: true })
  alignmentScore: number;

  @Column('boolean', { nullable: true })
  insideDemand: boolean;

  @Column('boolean', { nullable: true })
  insideSupply: boolean;

  @Column('double precision', { nullable: true })
  atr14Daily: number;

  @Column('double precision', { nullable: true })
  demandZoneHigh: number;

  @Column('double precision', { nullable: true })
  demandZoneLow: number;

  @Column('double precision', { nullable: true })
  supplyZoneHigh: number;

  @Column('double precision', { nullable: true })
  supplyZoneLow: number;

  @Column('double precision', { nullable: true })
  equalHighs: number;

  @Column('double precision', { nullable: true })
  equalLows: number;

  @Column({ nullable: true })
  lastBosDirection: string;

  @Column({ nullable: true })
  chochDirection: string;

  @Column('jsonb')
  rawJson: object;
}
