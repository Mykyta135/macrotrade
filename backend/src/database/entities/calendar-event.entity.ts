import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('calendar_events')
@Index(['eventDate', 'currency'])
@Index(['eventDate'])
export class CalendarEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamptz', name: 'event_date' })
  eventDate: Date;

  @Column({ length: 8 })
  currency: string;

  @Column({ length: 64 })
  impact: string;

  @Column({ length: 255 })
  event: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  actual: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  forecast: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  previous: string | null;
}
