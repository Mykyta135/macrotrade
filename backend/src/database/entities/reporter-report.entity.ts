import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('reporter_reports')
@Index(['generatedAt'])
export class ReporterReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  reportId: string;

  @CreateDateColumn()
  generatedAt: Date;

  @Column({ nullable: true })
  marketBias: string;

  @Column({ nullable: true })
  riskEnvironment: string;

  @Column('text', { nullable: true })
  executiveSummary: string;

  @Column('int', { nullable: true })
  inputTokens: number;

  @Column('int', { nullable: true })
  outputTokens: number;

  @Column('jsonb')
  fullJson: object;
}
