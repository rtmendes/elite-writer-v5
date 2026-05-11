# Elite Writer v5

AI-powered writing command center with intelligence gathering, publication matching, AI scoring, writing editor, pitch generation, data visualization (GIVE engine), and financial tracking.

## Setup
```bash
bun install
bun run dev     # local dev server (Vite)
bun run build   # production build
bun run db:push # push Drizzle schema to database
```

## Tech Stack
- **Framework:** React 18 + Vite + TypeScript
- **UI:** Mantine + Radix UI + Tailwind CSS
- **Database:** Drizzle ORM (PostgreSQL)
- **Editor:** BlockNote rich text editor
- **Deploy:** Vercel → `elite-writer-v5.vercel.app`

## Key Conventions
- Database schema lives in `drizzle/` or `src/db/schema.ts`
- Use Drizzle migrations for schema changes (`bun run db:push`)
- Component library: prefer Radix primitives + Tailwind, Mantine for complex UI
- API routes in `src/server/` or `app/api/`

## Important Rules
- Always run `bun run build` before committing
- Never commit `.env` files — use `.env.example` for templates
- Test database migrations locally before pushing to production
