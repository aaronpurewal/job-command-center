# CLAUDE.md — Project Context

## What This Is

Job Command Center v2: a job search scraper + auto-apply agent system for FDE / AI Deployment roles.

## Architecture

- **Frontend:** React (Vite) — dashboard showing scraped jobs, Apply buttons, scrape status
- **Backend:** Express API (TypeScript) — serves job data, triggers agents
- **Scrape engine:** Claude Agent SDK (WebSearch) + Anthropic Batch API (page parsing at 50% off)
- **Apply agent:** Claude Agent SDK + Playwright MCP + AskUserQuestion (terminal interaction)
- **Data store:** `server/data/jobs.json` (simple JSON, gitignored)

## Key Files

- `server/config/scrape-config.ts` — 25 title variations × 14 sites = query matrix
- `server/agents/scrape-agent.ts` — Agent SDK scrape orchestrator
- `server/scraper/batch-parser.ts` — Batch API page parser with few-shot prompt
- `server/agents/apply-agent.ts` — Agent SDK apply agent with Playwright MCP
- `server/agents/prompts/` — System prompts + few-shot examples
- `server/tools/` — Custom MCP tools (profile, resume, mark_applied, log)
- `src/App.jsx` — React frontend

## Commands

```bash
npm run dev          # Start frontend + backend concurrently
npm run scrape       # Run scrape agent (CLI)
npm run apply        # Run apply agent (see usage in file)
```

## Don't

- Don't modify profile.yaml (contains PII, gitignored)
- Don't commit .env, resume.pdf, or server/data/jobs.json
- Don't use LangChain — raw Agent SDK + Anthropic SDK only
- Don't auto-submit applications without human confirmation
