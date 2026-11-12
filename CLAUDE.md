# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

Four independent services, each with its own `package.json`/deps. There is no workspace root — install and run each separately.

MacroTrade uses the **39xx port range** so it never collides with other local
projects on this machine (3000 is usually taken).

| Dir | Stack | Port | Role |
|---|---|---|---|
| `backend/` | NestJS 11 + TypeORM + Postgres | 3901 | Fetches market data, scores pairs, serves the API |
| `frontend/` | Next.js 16 (app router) + Tailwind 4 | 3900 | Dashboard; consumes 3901 (and 3902) |
| `ai-reporter/` | Express + `@anthropic-ai/sdk` | 3902 | Sends backend data + news + playbook to Claude, returns a narrative report |
| `forexfactory-scraper/` | Python + venv | — | Scrapes the economic calendar to CSV for one-time import |
| `data/` | plain Node scripts | — | Offline KNN training pipeline; output is committed as `model.json` |

## Commands

```bash
# Postgres: this machine uses the Homebrew postgresql@17 service on :5432,
# already running with the `macrotrade` database. Do NOT `docker compose up`
# — that starts a second, empty DB (see docker-compose.yml).

# Backend
cd backend && npm run start:dev          # watch mode on :3901
npm run build | npm run lint | npm test
npx jest src/score/score.service.spec.ts # single test file (rootDir is src/)
npm run test:e2e                         # uses test/jest-e2e.json

# Frontend
cd frontend && npm run dev               # :3900 (port set in package.json)

# AI reporter
cd ai-reporter && npm run dev            # ts-node, :3902

# Scraper
cd forexfactory-scraper && source venv/bin/activate
python -m src.forexfactory.main --start 2024-01-01 --end 2024-12-31 --impact high --csv out.csv

# One-time data imports (after the scraper produces a CSV)
cd backend && npx ts-node scripts/import-calendar.ts
npx ts-node scripts/import-aaii.ts

# Retrain the KNN model (run in order; each step writes a JSON the next reads)
cd data/pipeline && node features.js && node label.js && node train.js
```

Start the backend before the ai-reporter: `WARMUP_ON_START` defaults to true, so the reporter immediately calls `BACKEND_URL` and its first report fails if 3901 isn't up.

Changing a port means changing it in **four** places — the service's own env, `NEXT_PUBLIC_API_URL`, `BACKEND_URL`, and the hardcoded CORS allowlist in `main.ts`. A frontend origin missing from that allowlist fails only in the browser, not in curl.

## Architecture

### The scoring cascade (`backend/src/score/score.service.ts`)

This is the heart of the system and the file to read first. It is a **hierarchical cascade with contextual inversion**, evaluated per pair in this order:

1. **R4 — Execution veto.** Calendar danger zone, high-impact news within 2h for either leg, VIX > 30.
2. **R1 — Macro baseline** (`getExpectedDirection`). A composite USD score votes across DXY bias, FRED fundamentals, yield-curve inversion, US10Y trend, real yield, and liquidity regime. Non-USD pairs fall through to pair-specific regional drivers (DAX→EUR, FTSE→GBP, Gold+Copper→AUD/NZD, Oil→CAD).
3. **R2 — Intermarket "lie detector"** (`detectR2Inversion`). Can **flip** the R1 direction. Order matters and is load-bearing: universal macro vetoes (VIX panic, SPX/HYG credit divergence, EEM capital flight) run *before* pair-specific checks (DAX/FXE, FTSE/FXB, Oil/FXC, Copper+USDCNH, Gold/FXF, Nikkei/FXY), because global panic must override regional drivers. Some branches return `inverted: false` with a warning `reason` — those signal WATCH without flipping.
4. **R3 — Sentiment/positioning.** Weighted points, max 5: retail sentiment (2), COT (2), correlation (1).

Final direction: `<3 pts` → NO TRADE; any kill switch failed → WATCH; otherwise the R2-effective direction. Kill switches carry an `unlockCondition` string — the UI shows the user what to wait for, so keep them actionable when editing.

Some comments in `detectR2Inversion` are in Ukrainian; they explain *why* the ordering is what it is. Preserve that intent when refactoring.

### Data flow

`ScoreService` fans out to five sibling services in parallel — `macro` (Yahoo Finance via `yahoo-finance2`), `sentiment` (Myfxbook), `cot` (CFTC), `calendar` (Forex Factory XML), `fred` (FRED API). Each caches through the shared `CacheService` (`node-cache`) with a domain-appropriate TTL: macro/sentiment/technical 15m, FRED 4h, calendar raw 1h with a 7-day stale fallback, COT keyed to the next CFTC release time. Adding a new data source means: service + module + controller, register in `app.module.ts`, and inject into `ScoreService`.

`MlService` loads `data/pipeline/model.json` at boot (`OnModuleInit`) — a hand-rolled KNN (no ML library; pure euclidean distance over normalized features). `RegimeService` composes ML + technical + macro + COT + FRED into a `RegimePayload` per pair.

Postgres persists OHLCV, technical snapshots, reporter reports, ML labels, the trade journal, calendar events, backtest cache, and AAII sentiment. **`synchronize: true` is on** — entity edits alter the live schema; there are no migrations.

### API surface

All routes are under the `/api` global prefix (set in `main.ts`), CORS-limited to localhost:3000/3001.

`/macro` `/sentiment` `/cot` `/calendar` `/fred` `/score` `/technical` `/technical/:pair` `/ml` `/ml/:pair` `/ml/regime/all` `/ml/regime/:pair` `/backtest` `/backtest/available-range` `DELETE /backtest/cache`, and full CRUD on `/journal` (+ `/journal/stats`).

`frontend/app/lib/api.ts` is the single client boundary. Note `api.technical()` reshapes the backend's `{ pairs: [] }` into a pair-keyed object — the API and UI shapes deliberately differ there.

### AI reporter

`Reporter.generateReport()` runs a three-tier cache: in-memory → disk (`data/last-report.json`, TTL-checked) → regenerate, guarded by an `isGenerating` flag that returns a degraded placeholder rather than duplicating work. Pipeline: fetch backend context + RSS news in parallel → load `playbook/*.md` (hot-loadable, no restart) → pre-classify headlines with Haiku (FUNDAMENTAL vs SHOCK) → main Sonnet call with the playbook in a cached system block.

Claude responses are JSON and defensively parsed: markdown fences stripped, `extractOutermostJson` walks brace depth (`lastIndexOf('}')` breaks on truncation), and `+N` numbers are rewritten to valid JSON. **Degraded parse-failure reports are deliberately not persisted** — otherwise bad content gets re-served from disk. Preserve that.

## Environment

- `backend/.env` — `FRED_API_KEY`, `MYFXBOOK_SESSION`, `PORT`, `DB_HOST/PORT/NAME/USER/PASSWORD`
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL`
- `ai-reporter/.env` — the key is read as **`CLAUDE_KEY`** (`config.ts` `requireEnv`), though `.env.example` and the README both say `ANTHROPIC_API_KEY`. `CLAUDE_KEY` is what actually works. Also `PORT`, `BACKEND_URL`, `CRON_SCHEDULE`, `REPORT_CACHE_TTL`, `WARMUP_ON_START`.

## Frontend: non-standard Next.js

`frontend/AGENTS.md` (which `frontend/CLAUDE.md` simply re-exports) warns that this Next.js version has breaking changes versus what's in training data. **Read the relevant guide under `frontend/node_modules/next/dist/docs/` before writing frontend code**, and heed deprecation notices there.

Charts use `lightweight-charts` v5.
