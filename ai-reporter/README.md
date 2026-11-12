# AI Reporter for MacroTrade

An AI-powered macro trade analysis service that synthesizes MacroTrade's rule-based scoring with financial news and your custom trading rules (playbook) to produce human-readable trade analysis reports.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and add your Anthropic API key:
```bash
cp .env.example .env
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env
```

### 3. Start the Service
```bash
npm run dev
```

The service will start on `http://localhost:3002`.

### 4. Visit the Dashboard
Open `http://localhost:3002` in your browser to see the AI report.

## Architecture

### Services
- **Backend (:3001)**: Provides macro scoring data (6 endpoints)
- **AI Reporter (:3002)**: Analyzes backend data + news + playbook rules
- **Frontend (:3000)**: Displays dashboards (consumes both :3001 and :3002)

### Data Flow
1. AI Reporter fetches from all 6 backend endpoints
2. Fetches latest financial news from RSS feeds (ForexLive, Investing.com, MarketWatch)
3. Loads playbook rules from `/playbook/` directory (hot-loadable)
4. Sends everything to Claude Sonnet 4.6 with structured prompts
5. Returns analyzed report with verdicts per pair

### Output
```json
{
  "executiveSummary": "4-6 sentence market overview",
  "pairs": [
    {
      "pair": "EUR/USD",
      "systemDirection": "BUY",
      "aiVerdict": "CONFIRMED|REJECTED|MODIFIED|WATCH|SKIP",
      "aiConfidenceAdjustment": -2 to +2,
      "aiRationale": "explanation",
      "newsRelevance": "relevant headlines",
      "playbookRulesApplied": ["00-example-rules.md"]
    }
  ],
  "topOpportunity": {...},
  "topWatch": {...},
  "newsHeadlines": [...],
  "playbookFilesLoaded": [...]
}
```

## API Endpoints

### GET /api/report
Returns cached report (fast). If cache is empty, generates a new one (~10-15s first time).

### GET /api/report?refresh=1
Forces report regeneration.

### POST /api/report
Same as `?refresh=1`.

### GET /api/health
Health check with uptime and last report info.

### GET /api/playbook
Lists loaded playbook files and total character count.

## Playbook System

The playbook is where you define trading rules to guide the AI. Drop markdown or text files in the `/playbook/` directory.

### Example Rule
```
When VIX > 25 and VVIX > 110, immediately shift from NEUTRAL to RISK-OFF bias.
Pre-panic conditions override normal macro analysis. Reduce size on ALL risk-on trades.
```

See `playbook/00-example-rules.md` for a full starter template.

### How It Works
1. You add/edit files in `/playbook/`
2. On next report generation, Claude loads all files
3. Claude analyzes rules alongside system data
4. AI cites which rules fired for each pair

No restart needed — just save files and refresh.

## Cron Scheduling

By default, reports regenerate every 4 hours via cron. Adjust with:
```bash
CRON_SCHEDULE="0 */2 * * *"  # Every 2 hours
CRON_SCHEDULE="0 * * * *"    # Hourly
```

## Environment Variables

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional
PORT=3002
BACKEND_URL=http://localhost:3001/api
CRON_SCHEDULE=0 */4 * * *    # Every 4 hours (default)
REPORT_CACHE_TTL=3600         # Cache for 1 hour
WARMUP_ON_START=true          # Generate report on boot
```

## Building for Production

```bash
npm run build
npm start
```

Output will be in `dist/` directory.

## Cost Estimate

- **Model**: Claude Sonnet 4.6 (~$0.05 per call with prompt caching)
- **Frequency**: 4-hourly by default = ~$0.30/day
- **With prompt caching**: ~$0.15/day (playbook unchanged)

## Troubleshooting

### "Failed to fetch from backend"
- Ensure NestJS backend is running on :3001
- Check `BACKEND_URL` env var

### "Claude API error"
- Verify `ANTHROPIC_API_KEY` is valid
- Check token usage on Anthropic dashboard

### "No playbook rules loaded"
- Add `.md` or `.txt` files to `/playbook/`
- Files must have valid content (not empty)

### "RSS feed down"
- News fetching is non-blocking — report generates without news if feeds are down
- Check which feeds are available: `curl https://www.forexlive.com/feed/news`

## Frontend Integration

To add the AI report to the existing Next.js frontend, see the dashboard at `public/index.html` for reference. The frontend can fetch `/api/report` from :3002 independently of the main backend.

## License

MIT
