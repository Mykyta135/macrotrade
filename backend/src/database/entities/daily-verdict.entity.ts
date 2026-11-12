import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Вердикт системи по одній парі за один день — для візуального бектесту.
 *
 * НАВІЩО ОКРЕМА ТАБЛИЦЯ, А НЕ backtest_cache:
 * backtest_cache зберігає повний JSON дня (~230 КБ) з усіма макро-, COT-,
 * technical-даними. Для графіка з зонами потрібні лише напрямок і бал —
 * 60 байт на пару. Уся історія (1700 днів × 8 пар) займе ~800 КБ замість
 * 382 МБ, і запит "усі вердикти по EUR/USD" стає індексованим, а не
 * розбором тисяч JSON-блобів.
 *
 * Заповнюється скриптом scripts/build-verdict-history.ts, який проганяє
 * бектест по днях (~1.4 с/день) і зберігає лише вердикт.
 */
@Entity('daily_verdicts')
@Index(['pair', 'date'], { unique: true })
export class DailyVerdict {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  pair: string;

  @Column({ type: 'date' })
  date: string;

  /** BUY | SELL | WATCH | NO TRADE */
  @Column({ type: 'varchar' })
  direction: string;

  @Column({ type: 'int' })
  score: number;

  /**
   * Куди схилялась система, навіть якщо вердикт WATCH/NO TRADE.
   *
   * WATCH означає "сетап є, але щось блокує" — і без цього поля на графіку
   * не видно, БУВ це заблокований BUY чи заблокований SELL. Береться з
   * R2-ефективного напрямку (той самий, що в tradeRecommendation).
   */
  @Column({ type: 'varchar', nullable: true })
  bias: string | null;

  /** A | B | C | WATCH | NO TRADE */
  @Column({ type: 'varchar', nullable: true })
  grade: string | null;

  /** Чи заблокований хоч один kill switch — пояснює WATCH */
  @Column({ type: 'boolean', default: false })
  killSwitchBlocked: boolean;

  /** Назва першого проваленого gate — щоб бачити причину на графіку */
  @Column({ type: 'varchar', nullable: true })
  blocker: string | null;

  /** Чи спрацював R2-детектор (інверсія напрямку) */
  @Column({ type: 'boolean', default: false })
  r2Inverted: boolean;
}
