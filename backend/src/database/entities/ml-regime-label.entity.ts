import { Entity, Column, PrimaryColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('ml_regime_labels')
@Index(['pair', 'date'])
export class MlRegimeLabel {
  @PrimaryColumn()
  pair: string;

  @PrimaryColumn({ type: 'date' })
  date: string;

  @Column({ nullable: true })
  knnRegime: string; // trending | ranging | volatile | crisis

  @Column({ nullable: true })
  volatilityCluster: string; // low | medium | high | crisis

  @Column('double precision', { nullable: true })
  cotPercentile: number; // 0-100

  @Column('double precision', { nullable: true })
  knnConfidence: number; // 0-1

  @Column('double precision', { nullable: true })
  directionalEfficiency: number;

  @Column('double precision', { nullable: true })
  atrRatio: number;

  @UpdateDateColumn()
  computedAt: Date;
}
