# Elite Writer V5 — Architecture Document

> AI-powered article factory for professional journalists. React 19 + tRPC + MySQL + BlockNote editor, deployed via Docker on Oracle VPS.

**Live URL:** `https://elitewriter.insightprofit.live`
**Repo:** `rtmendes/elite-writer-v5`
**VPS:** Oracle ARM (4 OCPU, 24GB RAM) at `129.213.162.114`

---

## Stack Overview

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, Radix UI, wouter (routing) |
| Editor | BlockNote 0.24 + Mantine 7.15 |
| API | tRPC v11 over Express |
| Database | MySQL 8 via Drizzle ORM |
| Auth | JWT + httpOnly cookies |
| AI/LLM | OpenRouter (multi-model), Anthropic, OpenAI, Perplexity, Gemini |
| Images | GPT Image 2, DALL-E 3, Gemini, PiAPI (multi-provider fallback) |
| Build | Vite (client), esbuild (server), Docker Compose |

---

## Project Structure

```
elite-writer-v5/
├── client/
│   ├── src/
│   │   ├── pages/                  # 14 page components (wouter routes)
│   │   │   ├── Dashboard.tsx       # Metrics overview, article stats
│   │   │   ├── Writer.tsx          # Core editor (1200+ lines) — BlockNote + sidebar
│   │   │   ├── Queue.tsx           # Pre-written article pipeline
│   │   │   ├── Giststack.tsx       # Content intelligence & trend curation
│   │   │   ├── Ideas.tsx           # Article idea pipeline
│   │   │   ├── Research.tsx        # Source gathering & deep research
│   │   │   ├── Publications.tsx    # 174+ publication database
│   │   │   ├── Pitches.tsx         # Pitch management
│   │   │   ├── Brands.tsx          # Brand & product engine
│   │   │   ├── Financial.tsx       # Revenue tracking
│   │   │   ├── Settings.tsx        # API keys & preferences
│   │   │   ├── Login.tsx           # Auth page
│   │   │   └── NotFound.tsx        # 404
│   │   ├── components/
│   │   │   ├── writer/             # Writer-specific components
│   │   │   │   ├── BlockNoteEditor.tsx   # Core editor wrapper (HTML↔Markdown↔PlainText)
│   │   │   │   ├── AgenticPanel.tsx      # AI writing agents (draft, enhance, rewrite)
│   │   │   │   ├── CreativePanel.tsx     # Image generation + infographics + mini-apps
│   │   │   │   ├── DataVizPanel.tsx      # GIVE Engine integration (interactive viz)
│   │   │   │   ├── ProductPanel.tsx      # eBooks, courses, lead magnets from articles
│   │   │   │   └── SettingsModal.tsx     # Writer config (AI, filters, export, scoring)
│   │   │   ├── AppLayout.tsx       # Main sidebar nav + theme
│   │   │   └── ui/                 # Radix-based design system (shadcn)
│   │   ├── lib/
│   │   │   ├── trpc.ts             # tRPC client
│   │   │   ├── quality-checker.ts  # Content quality enforcement (slop, US English, readability)
│   │   │   └── stores/             # Zustand stores
│   │   └── hooks/                  # Custom React hooks
│   └── index.html
├── server/
│   ├── _core/                      # Server infrastructure
│   │   ├── llm.ts                  # LLM invocation (Anthropic → OpenAI → OpenRouter fallback)
│   │   ├── imageGeneration.ts      # Multi-provider image gen (GPT-2 → DALL-E 3 → Gemini → PiAPI)
│   │   ├── trpc.ts                 # tRPC setup, middleware, protectedProcedure
│   │   ├── env.ts                  # Environment variable registry (25+ API keys)
│   │   ├── context.ts              # Request context (auth, db)
│   │   ├── cookies.ts              # JWT cookie management
│   │   ├── oauth.ts                # Google OAuth flow
│   │   └── systemRouter.ts         # Health checks, app info
│   ├── routers/                    # 17 tRPC routers
│   │   ├── queue.ts                # Article pipeline (discover→research→draft→proof→score)
│   │   ├── agentic.ts              # AI writing agents (autonomousDraft, enhanceSection, etc.)
│   │   ├── creative.ts             # Image gen, infographics, mini-apps
│   │   ├── give.ts                 # GIVE visualization engine
│   │   ├── research.ts             # Perplexity deep research, source management
│   │   ├── ai.ts                   # General AI utilities
│   │   ├── data.ts                 # CRUD for articles, ideas, pitches
│   │   ├── publications.ts         # Publication database & matching
│   │   ├── products.ts             # Product creation (eBooks, courses, lead magnets)
│   │   ├── news.ts                 # News & intelligence feeds
│   │   ├── media.ts                # Media management
│   │   ├── kb.ts                   # Knowledge base
│   │   ├── google.ts               # Google Workspace integration
│   │   ├── assets.ts               # Marketing assets
│   │   ├── feeds.ts                # RSS feeds & funnels
│   │   └── tools.ts                # Misc utilities
│   ├── routers.ts                  # Router aggregation → appRouter
│   ├── db.ts                       # Database connection
│   └── storage.ts                  # File storage
├── drizzle/
│   └── schema.ts                   # 21 MySQL tables
├── docker-compose.yml              # Single container (app + MySQL)
├── Dockerfile                      # Multi-stage build (pnpm)
└── package.json                    # pnpm workspace
```

---

## Database Schema (21 Tables)

| Table | Purpose |
|-------|---------|
| `users` | Auth accounts |
| `articles` | Core content (status: draft/review/scored/pitched/published) |
| `ideas` | Article idea pipeline |
| `pitches` | Pitch tracking for publications |
| `researchNotes` | Research source material |
| `brands` | Business entity profiles |
| `products` | Monetizable products per brand |
| `earnings` | Revenue tracking |
| `publications` | 174+ publication database |
| `intelligenceItems` | News/intelligence feed items |
| `intelligenceLearnings` | AI-generated intelligence insights |
| `dailyBriefs` | Auto-generated daily briefings |
| `feeds` | RSS feed subscriptions |
| `funnels` | Content marketing funnels |
| `kbItems` | Knowledge base entries |
| `marketingAssets` | Marketing collateral |
| `newsItems` | Curated news articles |
| `styleProfiles` | Writing style definitions |
| `googleTokens` | OAuth tokens for Google Workspace |
| `generatedImages` | AI-generated image history |
| `userSettings` | Per-user preferences |

---

## Core Flows

### 1. Full Pipeline (One-Click Article Factory)

```
Title → discoverTopics (trending analysis)
     → research (Gemini Flash / Perplexity)
     → outline (structured sections)
     → draft (Claude / GPT-4o / selected model, 2000+ words)
     → proofread (style, grammar, brand voice)
     → score (11 dimensions, 1-10 scale)
     → save to DB with status "review"
```

**Entry points:**
- Writer page → "Full Pipeline" button (single article)
- Queue page → "Generate Articles" button (batch, multiple topics)

### 2. Writer Page (Core Editor)

**Toolbar actions:**
- Insert Template → pre-built article structures
- AI Score → 11-dimension quality analysis
- AI Draft → quick LLM draft from title/outline
- Full Pipeline → complete research→draft→score flow
- Export → PDF, HTML, Plain Text, Markdown, Google Doc
- Save / Create Pitch
- Settings gear → config modal

**Sidebar (4 tabs):**
1. **Score** — AI scoring (11 dimensions) + quality report (slop, US English, readability grade)
2. **Write** — AI Agent panel + Research panel (deep research, import research notes)
3. **Create** — Creative panel (images, infographics) + DataViz panel (GIVE engine)
4. **Publish** — Publication matching + product opportunities

### 3. Content Quality Enforcement

**`quality-checker.ts`** runs on 800ms debounce:
- 30+ AI slop phrases flagged with severity (high/medium/low) + fix suggestions
- 60+ British → US English corrections
- Filler word counting
- Sentence length analysis
- Flesch-Kincaid readability score → letter grade (A–F)
- Quality gate: blocks export on D/F grades

### 4. Queue Pipeline

```
Queue Page → "Generate Articles" → discoverTopics (5 trending topics)
  → For each topic: generateArticle (full pipeline)
  → Articles appear as cards with score circles + quality grades
  → "Review" button → opens in Writer at /writer/:id
  → Status flow: draft → review → scored → pitched → published
```

---

## AI Model Routing

### LLM (`server/_core/llm.ts`)

| Model Alias | Routes To |
|-------------|-----------|
| `claude-sonnet` | Anthropic Claude Sonnet 4 (default) |
| `gpt-4o` | OpenAI GPT-4o |
| `gemini-flash` | Google Gemini 2.0 Flash (via OpenRouter) |
| `deepseek-r1` | DeepSeek R1 (via OpenRouter) |
| Any `provider/model` | OpenRouter direct routing |

**Fallback chain:** Anthropic → OpenAI → OpenRouter

### Image Generation (`server/_core/imageGeneration.ts`)

**Priority chain:**
1. GPT Image 2 (gpt-image-2) — highest quality, Apr 2026
2. GPT Image 1 (gpt-image-1) — fallback
3. DALL-E 3 — legacy
4. Gemini — native generation
5. PiAPI — additional provider

---

## Writer Settings (localStorage)

```typescript
{
  ai: {
    model: 'claude-sonnet',        // LLM model selection
    temperature: 0.7,              // Creativity (0.1–1.0)
    researchDepth: 'standard',     // light | standard | deep
    maxTokens: 4000,               // Output token limit
    autoResearch: false,           // Auto-research on new articles
    researchModel: 'perplexity',   // Research provider
  },
  filters: {
    enforceUsEnglish: true,        // Flag British spellings
    slopTolerance: 'strict',       // strict | moderate | relaxed
    maxSlopCount: 3,               // Block export threshold
    blockExportOnSlop: true,       // Prevent export with slop
    blockExportOnGrade: true,      // Prevent export on D/F grade
    bannedPhrases: [],             // Custom banned phrase list
    minPublishScore: 6,            // Minimum AI score to publish
  },
  export: {
    defaultFormat: 'pdf',          // Default export format
    fileNaming: '{title}-{date}',  // File naming pattern
    includeMetaHeader: true,       // Include metadata in exports
    includeMetaFooter: false,
  },
  scoring: {
    autoScore: false,              // Auto-score after drafting
    showQualityBadge: true,        // Show grade badge in toolbar
    minGradeToPublish: 'C',        // Quality gate
  }
}
```

---

## Deployment

### Docker Compose (single service)

```yaml
services:
  elite-writer:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/"]
      interval: 30s
      timeout: 5s
      retries: 3
```

### Deploy Pattern

```bash
git push origin main
ssh ubuntu@129.213.162.114
cd /opt/elite-writer-v5
git gc --prune=now && git fetch && git reset --hard origin/main
docker compose build --no-cache
docker compose down && docker compose up -d
# Verify: curl http://localhost:3000/ → HTTP 200
```

### Known Quirks
- VPS git has recurring `cannot lock ref` error → fix with `git gc --prune=now` before fetch
- pnpm requires `--no-frozen-lockfile` due to lockfile mismatch in Docker build
- No local `node` binary in sandbox — use Docker build for type checking
- Container shows "Login failed: Invalid credentials" in logs (expected — health check hits login endpoint)

---

## Environment Variables (25+)

| Variable | Service |
|----------|---------|
| `DATABASE_URL` | MySQL connection string |
| `JWT_SECRET` | Auth cookie signing |
| `ANTHROPIC_API_KEY` | Claude models |
| `OPENAI_API_KEY` | GPT-4o, DALL-E, GPT Image |
| `OPENROUTER_API_KEY` | Multi-model routing |
| `PERPLEXITY_API_KEY` | Deep research |
| `GEMINI_API_KEY` | Google AI models |
| `FAL_AI_API_KEY` | Fal.ai image models |
| `PIAPI_KEY` | PiAPI image generation |
| `STABILITY_AI_KEY` | Stability AI |
| `NEWSAPI_KEY` | NewsAPI |
| `GNEWS_KEY` | GNews API |
| `NEWSDATA_KEY` | Newsdata.io |
| `MEDIASTACK_KEY` | Mediastack news |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `YOUTUBE_API_KEY` | YouTube data |
| `SUPABASE_URL` | Supabase storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin |
| `APP_URL` | Public URL |
| `ADMIN_EMAIL` | Default admin login |
| `ADMIN_PASSWORD_HASH` | Default admin password |

---

## 11-Dimension AI Scoring

Articles are scored on these dimensions (1–10 scale each):

1. **Headline** — Clarity, hook, SEO
2. **Structure** — Logical flow, sections
3. **Evidence** — Data, sources, citations
4. **Voice** — Consistency with brand/publication
5. **Originality** — Unique angles, insights
6. **SEO** — Keywords, meta, internal links
7. **Readability** — Sentence variety, plain language
8. **Engagement** — Hooks, transitions, CTA
9. **Accuracy** — Fact-checking, claims verified
10. **Depth** — Thoroughness, expert-level
11. **Publication Fit** — Matches target outlet style

**Overall = weighted average of all 11 dimensions**

---

*Last updated: April 25, 2026*
