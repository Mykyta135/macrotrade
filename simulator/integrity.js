/**
 * ЗАХИСТ ВІД САМООБМАНУ.
 *
 * Проблема, яку цей модуль вирішує: коли ви можете крутити 15 параметрів,
 * ви ГАРАНТОВАНО знайдете комбінацію з гарним результатом — навіть якщо
 * стратегія не має жодної передбачувальної сили. Це математична неминучість,
 * а не слабкість характеру.
 *
 * Приклад: якщо пробувати конфіги, де кожен має 5% шансу випадково показати
 * "статистично значущий" результат, то після 20 спроб такий результат
 * з'явиться з імовірністю ~64%. І він буде фальшивим.
 *
 * Що робить цей модуль:
 *   1. Записує КОЖЕН прогін у runs.jsonl (хеш конфігу + результат + час).
 *   2. Рахує, скільки різних конфігів уже перевірено.
 *   3. Застосовує поправку Бонферроні: поріг значущості ділиться на кількість
 *      спроб. 20 спроб → потрібен результат, який випадково трапляється
 *      не в 5%, а в 0.25% випадків.
 *   4. Окремо рахує звернення до OUT-OF-SAMPLE — кожне після зміни правил
 *      знецінює цю перевірку.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RUNS_FILE = path.join(__dirname, 'runs.jsonl');

function configHash(config) {
  // Базові лінії не впливають на правила угоди — виключаємо з хешу
  const { baselines, ...rules } = config;
  return crypto.createHash('sha256').update(JSON.stringify(rules)).digest('hex').slice(0, 12);
}

function loadRuns() {
  if (!fs.existsSync(RUNS_FILE)) return [];
  return fs.readFileSync(RUNS_FILE, 'utf-8')
    .split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function recordRun(config, sample, result, timestamp) {
  const entry = {
    at: timestamp,
    hash: configHash(config),
    sample,                          // 'in-sample' | 'out-of-sample'
    trades: result.trades,
    expectancyR: result.expectancyR,
    winRate: result.winRate,
  };
  fs.appendFileSync(RUNS_FILE, JSON.stringify(entry) + '\n');
  return entry;
}

/**
 * Скільки РІЗНИХ конфігів перевірено. Повторний прогін того самого конфігу
 * не додає ступенів свободи, тому рахуємо унікальні хеші.
 */
function uniqueConfigsTried(runs) {
  return new Set(runs.map(r => r.hash)).size;
}

function outOfSampleLooks(runs) {
  return runs.filter(r => r.sample === 'out-of-sample').length;
}

/**
 * Односторонній t-тест: чи expectancy значущо більша за нуль.
 * Наближення нормальним розподілом — для n > 30 достатньо.
 */
function pValue(expectancyR, stdDevR, n) {
  if (n < 2 || stdDevR <= 0) return 1;
  const t = expectancyR / (stdDevR / Math.sqrt(n));
  // Апроксимація хвоста нормального розподілу (Abramowitz–Stegun)
  const z = Math.abs(t);
  const p = Math.exp(-0.5 * z * z) / (z * Math.sqrt(2 * Math.PI) + 1e-12);
  return t > 0 ? Math.min(1, p) : 1;
}

/**
 * Головна функція: чесний вердикт з урахуванням кількості спроб.
 */
function assess(config, sample, result) {
  const runs = loadRuns();
  const tried = Math.max(1, uniqueConfigsTried(runs) + 1);   // +1 = поточний
  const p = pValue(result.expectancyR, result.stdDevR, result.trades);

  // Поправка Бонферроні на множинне тестування
  const adjustedThreshold = 0.05 / tried;
  const significant = p < adjustedThreshold;

  const warnings = [];

  if (result.trades < 30) {
    warnings.push(
      `Лише ${result.trades} угод — статистично це майже нічого. ` +
      `Різниця між 45% і 55% вінрейту на такій вибірці не існує.`,
    );
  }
  if (tried > 5) {
    warnings.push(
      `Перевірено ${tried} різних конфігів. Чим більше спроб, тим імовірніше, ` +
      `що гарний результат — випадковість. Поріг значущості піднято до p < ${adjustedThreshold.toFixed(4)}.`,
    );
  }
  if (sample === 'out-of-sample') {
    const looks = outOfSampleLooks(runs) + 1;
    if (looks > 1) {
      warnings.push(
        `Це ${looks}-й погляд в out-of-sample. Кожен наступний після зміни правил ` +
        `перетворює цю вибірку на ще один in-sample — вона більше не є незалежною перевіркою.`,
      );
    }
  }
  if (config.execution.spreadPips === 0) {
    warnings.push('spreadPips = 0 — витрати ігноруються, результат завищений.');
  }

  return { tried, p, adjustedThreshold, significant, warnings };
}

module.exports = { configHash, loadRuns, recordRun, assess, uniqueConfigsTried, outOfSampleLooks };
