# Playbook Rules

The playbook is your trader's ground truth. Drop `.md` or `.txt` files here to define how the AI should interpret the system's scoring conclusions.

## What to Add

Each file should contain trading rules in plain English. Good sources:
- **YouTube Transcripts**: Paste edited transcripts from forex traders you follow
- **Expert Analysis**: Summary notes from macro strategists or market commentaries
- **Your Own Rules**: Trading principles that have worked for you historically
- **Divergence Patterns**: "When SPX up but HYG down..." rules
- **Volume/Volatility**: VIX, RSI, ADR thresholds you use
- **Timeframe Filters**: "Only trade Grade A or B signals", "Skip pairs in WATCH mode"

## Format Guidelines

Write in plain English. No special syntax required. Examples:

```
When VIX > 25 and EEM is bearish, reduce AUD/NZD confidence by 1 grade.
Only trade BUY signals on A or B grades. Skip C grades entirely.
If Fed is hawkish and liquidity is contracting, USD pairs are 2x more likely to succeed.
Watch for NDX/SMH divergence — it precedes AUD rallies by 1-2 weeks.
```

## How It Works

1. You add a file (e.g., `my-rules.md`)
2. On the next report, the AI loads all files in this directory
3. Claude analyzes your rules alongside the system data
4. AI cites which rules fired in the `playbookRulesApplied` field for each pair
5. AI can CONFIRM, REJECT, or MODIFY system recommendations based on rules

## Hot Reload

No restart needed — just save new files and refresh the report.

## Examples

See `00-example-rules.md` for a starter template with realistic forex rules.
