import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('aaii_sentiment')
export class AaiiSentiment {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'date' })
  reportDate: string;

  @Column({ type: 'float' })
  bullishPct: number;

  @Column({ type: 'float' })
  neutralPct: number;

  @Column({ type: 'float' })
  bearishPct: number;

  @Column({ type: 'float', nullable: true })
  bullBearSpread: number | null;
}
