<img src=".github/cover.png" alt="MacroTrade: scores forex pairs through a macro, intermarket and sentiment cascade" width="100%">

A personal swing-trading dashboard. Every day it pulls macro data, intermarket signals, positioning and the economic calendar, runs each forex pair through a scoring cascade, and says **BUY / SELL / WATCH / NO TRADE**, plus what has to change before a blocked pair unlocks. An AI reporter then writes the day's narrative from the same data.

It is a research tool I built for myself, not financial advice and not an order-executing bot.

> **About the git history.** I have been building MacroTrade since April 2026 as a personal tool. It was not under version control until I published it in November 2026, so the history here starts with that first commit.

<img src=".github/dashboard.png" alt="Dashboard: eight pairs with R4 veto, R1 macro, R2 lie detector, R3 confluence and the verdict; below, a visual backtest of past verdicts over the EUR/USD chart" width="100%">

## How a pair gets scored

The heart of the system is [`score.service.ts`](backend/src/score/score.service.ts): a hierarchical cascade where a failure at any stage caps the verdict downstream.

```mermaid
flowchart LR
    R4["<b>R4 · Execution veto</b><br/>calendar danger zone<br/>high-impact news &lt; 2h<br/>VIX &gt; 30"]
    R1["<b>R1 · Macro baseline</b><br/>USD composite: DXY, FRED,<br/>yield curve, real yield, liquidity<br/>regional drivers for crosses"]
    R2["<b>R2 · Intermarket lie detector</b><br/>can <i>flip</i> R1:<br/>VIX panic, credit divergence,<br/>EEM flight, then pair-specific"]
    R3["<b>R3 · Confluence</b><br/>retail sentiment 2<br/>COT 2 · correlation 1"]
    V{{"verdict"}}
    R4 -- clear --> R1 --> R2 --> R3 --> V
    R4 -- veto --> X["NO TRADE"]
    V -- "&lt; 3 pts" --> N["NO TRADE"]
    V -- "kill switch" --> W["WATCH + unlock condition"]
    V -- ok --> T["BUY / SELL"]
```

Order inside R2 is load-bearing: global panic checks run before regional ones, because a VIX spike should override what the DAX says about the euro.

## Architecture

```mermaid
flowchart TB
    subgraph sources[Data sources]
        direction LR
        Y[Yahoo Finance] ~~~ F[FRED] ~~~ M[Myfxbook sentiment] ~~~ C[CFTC COT] ~~~ FF[Forex Factory calendar]
    end
    subgraph backend["backend · NestJS 11 + TypeORM + Postgres :3901"]
        S[ScoreService] --> CS[(node-cache<br/>per-source TTL)]
        ML[MlService<br/>hand-rolled KNN] --> RS[RegimeService]
        BT[Backtest] & J[Trade journal]
    end
    subgraph reporter["ai-reporter · Express :3902"]
        H[Haiku: classify headlines] --> SN[Sonnet: daily report<br/>playbook in a cached system block]
    end
    FE["frontend · Next.js 16 + lightweight-charts :3900"]
    sources --> backend
    backend --> reporter
    backend --> FE
    reporter --> FE
```

- **Caching per source:** macro and sentiment every 15 min, FRED every 4 h, the calendar hourly with a 7-day stale fallback, COT keyed to the next CFTC release.
- **ML without a library:** `data/pipeline` builds features and labels from history and trains a KNN (plain euclidean distance over normalised features) that the backend loads at boot.
- **Defensive LLM parsing:** the reporter strips fences, walks brace depth to find the outermost JSON, and never persists a degraded report, so a bad parse is not re-served from disk.

## Run it

Needs Node 20+, Postgres, a FRED API key, and an Anthropic key for the reporter.

```bash
cd backend && cp .env.example .env && npm i && npm run start:dev   # :3901
cd frontend && cp .env.example .env.local && npm i && npm run dev   # :3900
cd ai-reporter && cp .env.example .env && npm i && npm run dev      # :3902 (start after the backend)
```

Tests: `cd backend && npm test`.

## Not in this repo

- Historical OHLCV exports and scraped calendar CSVs: they are licensed or scraped data, so they stay local. The pipeline scripts that consume them are here.
- The Forex Factory scraper: a third-party GPL-3.0 project I ran locally for a one-time calendar import.

More detail (in Ukrainian): [docs/](docs/).
