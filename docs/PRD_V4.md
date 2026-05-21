# Elite Writer App — Product Requirements Document v4
**Last Updated:** April 6, 2026  
**Status:** Active Development  
**Architecture:** Cloudflare Pages + Functions · Supabase · OpenRouter / Anthropic / OpenAI  

---

## 1. Executive Summary & Vision

Elite Writer is an AI-native editorial workspace built for the Bloomberg-caliber freelance journalist pursuing a $100K+/month publication business. It is not a generic writing tool. It is an end-to-end intelligence system that discovers story opportunities in the news, matches them to the highest-paying publications, helps draft and pitch those stories, and tracks the revenue outcomes.

**Core premise:** The best freelance writers don't struggle with writing — they struggle with pipeline management, publication research, and pitch volume. Elite Writer automates the entire intelligence layer so the journalist can spend more time writing and less time doing spreadsheet research.

**North Star Metric:** Stories pitched per week → acceptances per month → dollars earned per quarter.

**Target Revenue Model:**
- Freemium (limited briefs/month) → $49/month Starter → $99/month Pro → $199/month Agency
- Projected path to $100K MRR: 500 Pro users + 100 Agency users

---

## 2. Target User

**Primary Persona: The Bloomberg-Caliber Freelance Journalist**

- Writes for 3-8 publications simultaneously
- Targets $1–$4/word publications (Business Insider, Forbes, The Atlantic, Bloomberg, MIT Technology Review)
- Current pain: manually tracking 50+ publications in a spreadsheet, missing pitch windows, no system for matching daily news to publication beats
- Technical comfort: uses Notion, reads newsletters, comfortable with web apps but not a developer
- Device: MacBook Pro + iPhone; works in browser

**Secondary Persona: The Emerging Freelancer**
- 1-3 years experience, targeting $0.50–$1/word publications
- Uses Elite Writer to learn which publications to target and how to structure pitches

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser Client                     │
│  React/TypeScript · Plate.js editor · Tailwind CSS  │
│  Supabase Auth · localStorage for API key mgmt      │
└────────────────────────┬────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────┐
│              Cloudflare Pages                        │
│  Static assets (HTML/JS/CSS) + Pages Functions       │
│                                                      │
│  /api/llm               — LLM proxy (4 providers)   │
│  /api/news              — NewsAPI proxy (US only)    │
│  /api/gnews             — GNews proxy (US only)      │
│  /api/intelligence/     — Scoring & daily brief      │
│  /api/kb/               — Knowledge base CRUD        │
│  /api/generate-image-advanced — Editorial images     │
└────────────────────────┬────────────────────────────┘
                         │ REST
┌────────────────────────▼────────────────────────────┐
│                    Supabase                          │
│  PostgreSQL · pgvector · Row Level Security         │
│  Tables: documents, knowledge_items, kb_embeddings  │
│          publications, pitches, analytics_events     │
└─────────────────────────────────────────────────────┘
```

**LLM Routing (priority order):**
1. OpenRouter (access to 200+ models including Claude, GPT-4, Llama)
2. Anthropic (Claude direct API)
3. OpenAI (GPT-4o)
4. Google Gemini

**API Key Management:** Keys can be configured server-side as Cloudflare env vars OR client-side in Settings → API Keys (stored in localStorage). Client keys are injected as request headers (`x-openrouter-key`, `x-anthropic-key`, `x-openai-key`, `x-gemini-key`) and accepted by all `/api/*` functions. This enables zero-env-var deployments for individual users.

---

## 4. Features

### 4.1 News Intelligence Dashboard

**Purpose:** Surface the 10-15 most relevant US news stories every morning, filtered to the journalist's beat.

**Implementation:**
- Sources: NewsAPI (`/api/news`) + GNews (`/api/gnews`), both hardcoded to `country=us`
- Post-filter on server: excludes Indian/non-US sources (Times of India, NDTV, Hindustan Times, Economic Times, India Today, The Hindu, Mint, Livemint, Business Standard India, Moneycontrol, Zee News, ABP Live, News18)
- NewsAPI routing: `?country=us` always uses `/v2/top-headlines` (native country filter); absence of country param no longer falls through to `/v2/everything`
- GNews routing: `country` param is hardcoded to `us` on the server; client cannot override it

**UI:** Card grid with headline, source, publication date, and one-click "Add to Daily Brief" action.

**Fix Status (v4):** US filtering bug resolved. Default behavior now enforces US-only results.

### 4.2 Content Decision Engine — Daily Brief

**Endpoint:** `POST /api/intelligence/daily-brief`

**Purpose:** Given today's news items, return a ranked list of story-publication matches the journalist should act on.

**Algorithm:**
1. Input: `{ user_id, date, news_items[] }`
2. Fetch user's publication KB (knowledge_items where item_type='publication') or fall back to seed list of 12 top-paying publications
3. Fetch recent pitch history (last 30 days) to avoid re-pitching
4. Build a scoring prompt and call LLM (Claude preferred via OpenRouter)
5. Scoring axes (0–100 per match):
   - Topic/beat alignment: 40 pts
   - Article type fit: 30 pts
   - Pitch angle quality: 20 pts
   - Timeliness: 10 pts
   - Penalty: -25 pts for recent pitch to same publication on similar topic
6. Return top 5-10 matches with score >= 55, ranked descending

**Output per match:**
```json
{
  "story_title": "...",
  "publication": "Forbes",
  "match_score": 87,
  "pitch_angle": "One-sentence unique angle",
  "article_type": "feature",
  "word_count_target": 1500,
  "deadline": "this week",
  "why_this_pub": "...",
  "hook": "Opening line for pitch email"
}
```

**Fix Status (v4):** New file created. Wires into existing `/api/llm` and Supabase KB.

### 4.3 Writing Editor — Three-Pane Layout

**Component:** `src/components/PlateEditor.tsx`

**Layout:** Bloomberg Terminal / Linear professional standard — three collapsible panes:

**Left Pane — Outline Panel (220px, collapsible):**
- Auto-extracts H2/H3 headings from editor content
- Displays heading hierarchy with indentation
- Word count progress bar (current / target)
- Click heading → scroll to section (future)

**Center Pane — Distraction-Free Editor:**
- Header bar: `[◀ Outline] · [Publication Name] → [Article Type] → [Word Target: 1,200 / 1,500] [◇ Pitch Mode] [✓ Saved] [AI Assist ▶]`
- Editor body: Georgia serif font, 17px, 1.75 line height — article body only; UI remains Inter
- Plate.js rich text with slash commands, floating toolbar
- Pitch Mode toggle: activates a banner prompting hook/clarity/fit review

**Right Pane — AI Assist Drawer (220px, collapsible):**
- Generate Section: suggests 2-3 additional sections for the draft
- Suggest Sources: recommends 5 credible sources to consult
- Check Style: flags clichés, passive voice, weak verbs with specific rewrites
- All actions call `/api/llm` with client-injected API keys

**Bottom Status Bar:**
- Live word count · Reading time (words/200) · Flesch readability score + label (Easy/Standard/Difficult/Very Difficult)
- "Ready to Pitch" indicator: green when wordCount >= 85% of target AND Flesch >= 30

**Design Tokens:**
```css
--bg-primary: #0d0d0d;
--accent-primary: #7c3aed;
--editor-font: 'Georgia', 'Times New Roman', serif;
--ui-font: 'Inter', system-ui, sans-serif;
```

**Auto-save:** 3-second debounce → Supabase `documents` table (saves content, content_html, content_markdown, wordCount, readingTime).

**Fix Status (v4):** Complete redesign from single-pane to three-pane with status bar.

### 4.4 Knowledge Base — Publications Database

**Tables:** `knowledge_items` (general KB), `kb_embeddings` (pgvector for semantic search)

**Item Types:** `publication` | `story_idea` | `contact` | `deadline` | `pitch_result` | `general`

**Publications CSV data** (imported via `/api/publications/seed`):
- 50+ publications with traffic, pay range, article types, editor contacts
- Fields: Publication, Website Traffic, Call for Pitches URL, Pay Range Per Article
- Pay ranges from $150/article (GameSpot) to $10,000–$30,000/article (Cosmopolitan video)

**Semantic search:** `/api/kb/search` → pgvector cosine similarity on `kb_embeddings`; embedding model: `text-embedding-3-small` (OpenAI)

**Chunk strategy:** 400-token target, 50-token overlap, paragraph-boundary splits, sentence-boundary fallback for oversized chunks.

### 4.5 Natural Language Notes Pipeline

**Endpoint:** `POST /api/kb/add-note`

**Purpose:** "Just type a note and it routes itself." The journalist types raw notes; the system auto-categorizes, extracts metadata, and stores them semantically searchable.

**Flow:**
1. Receive `{ note, user_id, publication_hint? }`
2. Call Claude to extract:
   - `entity_type`: publication | story_idea | contact | deadline | pitch_result | general
   - `publication_name`, `pay_range`, `article_types`, `contact_name`, `contact_email`, `summary`, `tags`, `story_angle`
3. Upsert into `knowledge_items` (update existing by title match, or insert new)
4. Fire-and-forget embed call to `/api/kb/embed` (non-blocking)
5. Return `{ ok, item_id, categorized_as, publication, summary, tags, title }`

**Example input:**
```
"pitch.success.com is a new pitch portal for Success.com. They added it recently.
Pay is $1/word for lifestyle and entrepreneurship stories. Editor is Sarah Chen."
```

**Example output:**
```json
{ "ok": true, "categorized_as": "publication", "publication": "Success.com",
  "summary": "Success.com accepts pitches at pitch.success.com at $1/word for lifestyle/entrepreneurship.",
  "tags": ["lifestyle", "entrepreneurship", "success"] }
```

**Fix Status (v4):** New file created at `/functions/api/kb/add-note.js`.

### 4.6 Image Generation — Editorial Mode

**Endpoint:** `POST /api/generate-image-advanced`

**New editorial mode:** When `article_title` / `article_summary` / `section_heading` are provided instead of a raw `prompt`, the function auto-builds a photorealistic editorial prompt matching the publication style.

**DALL-E 3 prompt template:**
```
"[Publication style] editorial photography for an article about: "[topic]".
[Scene description]. Professional lighting, high resolution, suitable for
magazine cover or feature story. No text overlays. No illustrations.
Photorealistic documentary photography. Shot on medium format camera."
```

**Scene inference** (topic keyword matching):
- Tech/AI → modern office, screens, natural light
- Finance → financial district, glass buildings, business professional
- Health → clinical/wellness environment, soft light
- Climate → aerial renewable energy or landscape, dramatic light
- Politics → government building exterior, overcast sky
- Food → styled food photography, shallow DOF
- Travel → cityscape, golden hour, wide shot
- Default → documentary-style visual metaphor

**Style hints:** bloomberg | forbes | fortune | nyt | atlantic | default

**Model routing:** `dalle3` → DALL-E 3 (quality: hd, style: natural); `runware:*` → Runware; `fal:*` → Fal.ai

**Fix Status (v4):** DALL-E 3 editorial route added. `prompt_used` included in response for debugging.

### 4.7 Analytics & Revenue Tracking

**Planned (not yet built — roadmap):**

Track the complete pitch-to-payment funnel:
- Stories identified from news
- Pitches drafted and sent
- Responses received (accept / reject / no response)
- Articles published
- Payments received

**Revenue dashboard metrics:**
- Monthly revenue (actual vs. target)
- Acceptance rate by publication
- Average time from pitch to acceptance
- Revenue per word by publication
- Best-performing topics / beats

**Implementation plan:** Supabase `pitches` table + `analytics_events` table + dashboard component.

### 4.8 Natural Language Chat Interface (In-App Agent)

**Planned (not yet built — roadmap):**

An in-app Claude agent that understands the journalist's full context (KB, pitch history, drafts) and can answer questions like:
- "Which publications haven't I pitched in 30 days that match this story?"
- "What's my acceptance rate at Forbes vs. Business Insider?"
- "Rewrite this intro to sound more Bloomberg and less academic"
- "Find my notes about the editor at MIT Technology Review"

**Implementation:** Uses `/api/llm` + `/api/kb/search` (vector search) for RAG-style context retrieval.

---

## 5. API Key Management

**Server-side (Cloudflare env vars):**
- `OPENROUTER_API_KEY` — preferred; gives access to Claude, GPT-4, Llama, etc.
- `ANTHROPIC_API_KEY` — direct Anthropic API
- `OPENAI_API_KEY` — GPT-4o + DALL-E 3 + embeddings
- `GEMINI_API_KEY` — Google Gemini
- `NEWSAPI_KEY` — NewsAPI.org
- `GNEWSAPI_KEY` — GNews.io
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — database
- `RUNWARE_API_KEY` — Runware image generation
- `FAL_AI_API_KEY` — Fal.ai image generation

**Client-side (localStorage → headers):**
Users who deploy without env vars can configure keys in Settings → API Keys. The frontend stores them in localStorage and injects them as request headers on every API call:
- `x-openrouter-key`, `x-anthropic-key`, `x-openai-key`, `x-gemini-key`
- `x-newsapi-key`, `x-gnews-key`

The server uses `env.KEY || request.headers.get('x-KEY') || ''` fallback pattern throughout. This is identical to how `gnews.js` already worked, now extended to all functions.

**Security note:** Client-injected keys are transmitted over HTTPS only. The app does not log or store keys server-side.

---

## 6. US-Only News Filtering Rules

All news fetching is hardcoded to US sources. No other country is permitted.

**NewsAPI (`/api/news`):**
- Default behavior (no `country` param): routes to `/v2/top-headlines?country=us`
- `country=us` explicit: same as above
- Any other country: routes to `/v2/everything` with language=en (fallback for non-US requests if explicitly needed)
- Post-filter: strips articles from these sources regardless of endpoint: Times of India, NDTV, Hindustan Times, Economic Times, India Today, The Hindu, Mint, Livemint, Business Standard India, Moneycontrol, Zee News, ABP Live, News18

**GNews (`/api/gnews`):**
- `country=us` hardcoded in server; client cannot override
- Any `country` param from client is ignored

---

## 7. Publication Matching Algorithm

Used in `/api/intelligence/daily-brief`. Scores story-publication pairs 0–100.

**Scoring dimensions:**

| Dimension | Weight | How Measured |
|-----------|--------|--------------|
| Topic/beat alignment | 40 pts | LLM semantic match: story topic vs. publication focus |
| Article type fit | 30 pts | Does story call for a type the pub accepts? |
| Pitch angle quality | 20 pts | How distinctive/compelling is the angle? |
| Timeliness | 10 pts | How urgently should this be pitched today? |
| Recent pitch penalty | -25 pts | If pitched same pub on similar topic in last 30 days |

**Match threshold:** 55/100 minimum to appear in brief.

**Publication data sources (priority):**
1. User's KB (knowledge_items where item_type='publication')
2. Seed list: 12 top-paying publications from the Publications That Pay CSV

---

## 8. Monetization

### Tier Structure

| Tier | Price | Daily Briefs | Publications DB | AI Assists | Image Gen |
|------|-------|-------------|-----------------|------------|-----------|
| Free | $0 | 3/month | 10 pubs | 10/month | No |
| Starter | $49/month | 30/month | 50 pubs | 100/month | 20/month |
| Pro | $99/month | Unlimited | Unlimited | Unlimited | 100/month |
| Agency | $199/month | Unlimited | Unlimited | Unlimited | Unlimited + API |

### Revenue Projections (Path to $100K MRR)

| Tier | Users Needed | MRR Contribution |
|------|-------------|-----------------|
| Pro (500 users) | 500 × $99 | $49,500 |
| Agency (100 users) | 100 × $199 | $19,900 |
| Starter (600 users) | 600 × $49 | $29,400 |
| **Total** | **1,200 users** | **$98,800** |

### Implementation Plan
- Stripe billing → Supabase `subscriptions` table
- Feature flags per tier via RLS policies
- Usage metering via `analytics_events` table

---

## 9. Integration Roadmap

### Phase 1 (Current)
- NewsAPI, GNews (US news)
- Supabase (DB + auth + vector search)
- OpenRouter / Anthropic / OpenAI / Gemini (LLM)
- Runware, Fal.ai, DALL-E 3 (images)

### Phase 2 (Q3 2026)
- **Google Calendar:** Auto-schedule pitch deadlines from daily brief; block writing time for accepted pitches
- **RSS Feeds:** Subscribe to publication RSS feeds; surface stories editors are actively covering (better topic alignment)
- **Newsletter ingestion:** Parse editor newsletters (e.g., HARO, Scoopika) for pitch calls

### Phase 3 (Q4 2026)
- **YouTube channels:** Monitor journalist/editor YouTube channels for topic signals
- **Substack monitoring:** Track high-signal Substacks for emerging story angles
- **CRM integration:** Sync pitch history with HubSpot or Airtable for agency users
- **Mobile app:** iOS/Android for capturing story ideas and quick notes on the go

### Phase 4 (2027)
- **AI pitch assistant:** Drafts the full pitch email, not just the angle
- **Editor network:** Database of editor email addresses, preferences, and response rates
- **Collaborative workspaces:** Multiple writers sharing publication DB and pitch tracking

---

## 10. Known Issues & Fix Status (v4)

| # | Issue | File | Fix Applied | Status |
|---|-------|------|-------------|--------|
| 1 | LLM API keys dropped when env vars missing | `functions/api/llm.js` | Client header fallback (`x-openrouter-key`, `x-anthropic-key`, `x-openai-key`, `x-gemini-key`) | ✅ Fixed v4 |
| 2 | Indian/global articles leaking into news feed | `functions/api/news.js`, `gnews.js` | US default routing + post-filter for Indian sources | ✅ Fixed v4 |
| 3 | Editor single-pane, no word count/readability | `src/components/PlateEditor.tsx` | Three-pane layout (outline + editor + AI assist), Flesch score, status bar, pitch mode | ✅ Fixed v4 |
| 4 | No story-publication matching pipeline | `functions/api/intelligence/` | Built `daily-brief.js` with LLM scoring and KB integration | ✅ Fixed v4 |
| 5 | No natural language notes capture | `functions/api/kb/` | Built `add-note.js` with Claude extraction + Supabase upsert + embed trigger | ✅ Fixed v4 |
| 6 | Image gen produces illustrations not editorial photos | `functions/api/generate-image-advanced.js` | DALL-E 3 editorial route with photorealistic scene-inference prompts | ✅ Fixed v4 |
| 7 | Analytics & revenue tracking | Not built | — | 📋 Roadmap |
| 8 | In-app agent chat | Not built | — | 📋 Roadmap |
| 9 | Mobile app | Not built | — | 📋 Roadmap |
| 10 | Pitch draft automation | Not built | — | 📋 Roadmap |

---

## 11. File Structure (Key Files)

```
/functions/api/
  llm.js                          — LLM proxy (4 providers + client key headers)
  news.js                         — NewsAPI proxy (US-only, post-filtered)
  gnews.js                        — GNews proxy (US hardcoded)
  generate-image-advanced.js      — Runware + Fal.ai + DALL-E 3 editorial mode
  intelligence/
    daily-brief.js                — Story-publication matching engine [NEW v4]
    apply.js                      — Apply learnings to content
    learn.js                      — Extract learnings from content
    patterns.js                   — Pattern discovery across content
  kb/
    add-note.js                   — Natural language notes pipeline [NEW v4]
    embed.js                      — OpenAI embedding pipeline
    search.js                     — pgvector semantic search
    extract.js                    — KB item extraction
    import.js                     — Bulk KB import
  publications/
    seed.js                       — Seed publications from CSV
    upsert.js                     — Upsert publication records

/src/components/
  PlateEditor.tsx                 — Three-pane editor [REDESIGNED v4]
  AISidePanel.tsx                 — AI side panel (legacy)
  DocumentsPage.tsx               — Documents list/management

/Publications That Pay Database - Editor Call For Pitches.csv
  — 50+ publications with pay ranges, pitch URLs, traffic data
```

---

*PRD v4 — All six fixes applied. Commit: `fix: LLM key headers, US news filter, editor layout, daily-brief intelligence, notes pipeline, editorial image gen`*
