function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3002),
  backendUrl: process.env.BACKEND_URL ?? 'http://localhost:3001/api',
  // ANTHROPIC_API_KEY as documented in .env.example; CLAUDE_KEY still works for older setups.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || requireEnv('CLAUDE_KEY'),
  cronSchedule: process.env.CRON_SCHEDULE ?? '0 */4 * * *',
  reportCacheTtl: Number(process.env.REPORT_CACHE_TTL ?? 3600),
  warmupOnStart: process.env.WARMUP_ON_START !== 'false',
};
