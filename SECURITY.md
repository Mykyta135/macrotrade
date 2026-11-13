# Security

## Review, November 2026

MacroTrade is a personal tool that runs on my laptop. Before linking it from my CV I reviewed it as if someone ran it as documented: secrets in the code and git history, services exposed beyond the machine, paid API calls anyone could trigger, and untrusted data reaching the browser. The review was AI-assisted (Claude Code); findings were checked against the code.

### Fixed

| Area | Problem | Fix |
|---|---|---|
| XSS | News headlines (third-party feeds) and AI rationales went into `innerHTML` unescaped | Escaped; news links must be http(s) |
| Cost | A forced report refresh (paid model call) had no limit | At most once per 5 minutes, otherwise the cached report |
| Exposure | The AI reporter listened on all interfaces | `127.0.0.1` by default (`HOST` to override) |
| Database | docker-compose Postgres used passwordless `trust` auth on every interface | Password required; published on `127.0.0.1` only |
| Config | The code read `CLAUDE_KEY` while `.env.example` documented `ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY`, with `CLAUDE_KEY` as a fallback |

No secrets were found in the code or history.

### Known limitations (local tool)

- The backend API has no authentication and uses `synchronize`; it is not meant to be deployed.
- News text is passed to the LLM as data, so a crafted headline could still bend the narrative it writes; verdicts come from the deterministic cascade, not the LLM.
