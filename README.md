# Elite Writer v5

**Canonical Elite Writer repository** — an AI-powered writing command center for professional journalists and content creators. Covers the full workflow from intelligence gathering and research through publication matching, AI scoring, rich-text editing, pitch generation, and financial tracking.

**Live:** [elitewriter.insightprofit.live](https://elitewriter.insightprofit.live)  
**Command Center iframe:** [command.insightprofit.live/#/iframe-elite-writer](https://command.insightprofit.live/#/iframe-elite-writer)  
**Repo:** [github.com/rtmendes/elite-writer-v5](https://github.com/rtmendes/elite-writer-v5)

> The legacy `elite-writer-app` repo is archived. All active development happens here.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4, Radix UI, shadcn/ui, Framer Motion |
| Routing | wouter |
| API | tRPC v11 over Express |
| Database | MySQL 8 via Drizzle ORM |
| Editor | BlockNote + Plate.js |
| AI | OpenRouter (multi-provider), Anthropic, OpenAI, Perplexity, Gemini |
| Charts | Recharts |
| Auth | JWT + httpOnly cookies |

## Features

- **Content Command HQ** — publication matching, pitch generation, Giststack intelligence
- **Writing Editor** — BlockNote/Plate rich-text editor with AI agents, export, and scoring
- **AI Scoring** — 11-dimension article quality scorecard (clarity, hook, voice, data, originality, and more)
- **Publications Database** — 174+ target publications with pay rates and style intelligence
- **Kanban Pipeline** — 8-column project tracking from idea to published
- **Financial Accelerator** — revenue tracking and $100K–$200K monetization engine
- **Research Hub** — academic search (OpenAlex, CrossRef, Semantic Scholar) and deep research
- **Video Scripts** — AI video script generation
- **Data Visualization** — Visual Capitalist–style infographics and GIVE engine
- **Offer Creation** — product and service offer builder
- **RAG Integration** — knowledge base, memory, and content context wiring
- **Pulse Pipeline** — feed ingestion, trending curation, and content calendar
- **Task Center & Agents** — proactive AI agents and workflow automation

## Project Structure

```
elite-writer-v5/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── pages/       # Route-level page components
│       ├── components/  # Shared UI and feature components
│       ├── hooks/       # Custom React hooks
│       └── lib/         # Utilities, tRPC client, stores
├── server/          # Express + tRPC backend
│   ├── _core/       # Auth, LLM routing, env, middleware
│   └── routers/     # Feature routers (queue, research, publications, …)
├── drizzle/         # Drizzle schema and migrations
├── shared/          # Shared types and constants
├── data/            # Publications CSV databases
└── docs/            # PRDs, roadmap, architecture notes
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [pnpm](https://pnpm.io/) (recommended; see `packageManager` in `package.json`)
- MySQL 8 (local or remote) for full backend functionality

### Installation

```bash
git clone https://github.com/rtmendes/elite-writer-v5.git
cd elite-writer-v5
pnpm install
```

### Environment

Copy `.env.production.template` to `.env` (or `.env.production`) and fill in required values — at minimum `DATABASE_URL`, `JWT_SECRET`, and at least one AI provider key (e.g. `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY`).

### Development

```bash
pnpm dev          # Vite client + Express/tRPC server (hot reload)
pnpm check        # TypeScript type check
pnpm test         # Vitest unit tests
pnpm lint         # ESLint
```

### Build & Production

```bash
pnpm build        # Vite client build + esbuild server bundle
pnpm start        # Run production server from dist/
pnpm db:push      # Generate and apply Drizzle migrations
pnpm validate     # Type check + lint
```

### Docker (Oracle VPS)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for Docker Compose deployment on the production Oracle VPS.

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Stack, schema, deployment, and server layout |
| [AGENTS.md](./AGENTS.md) | AI agent instructions for contributors |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Feature roadmap |
| [docs/PRD_V4.md](./docs/PRD_V4.md) | Product requirements |
| [docs/UI_STANDARDS.md](./docs/UI_STANDARDS.md) | UI conventions |

## Contributing

1. Create a feature branch from `main` (do not push directly to `main`)
2. Run `pnpm build` before committing
3. Test database migrations locally before pushing schema changes
4. Preserve existing functionality — do not remove working features

## License

MIT
