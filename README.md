# SecondBrain — A Personal People Knowledge Graph

A second brain focused on the **people** in your life.
Drop in messy natural-language notes; SecondBrain extracts the people, their attributes, and the relationships between them into a living, evolving graph that you can search, visualize, and query.

> Capture → Interpret → Connect → Update → Summarize → Retrieve

A single **Next.js** app — server components fetch data straight from Postgres, mutations run via server actions, no separate backend.
Designed to deploy to **Vercel** in one click, with **Neon Postgres** as the database, **Groq** as the LLM, and **Tavily** for web enrichment.

---

## Features

- **Capture** any messy note. Groq extracts people, attributes, and relationships in a single round-trip.
- **Fuzzy entity resolution** — never creates duplicate people for "John", "John Carter", or nicknames.
- **Evolving profiles** with auto-regenerated, human-feeling summaries per person.
- **Confidence tracking** on every fact (1.0 = stated, 0.4 = inferred, etc.).
- **Contradiction handling** — when new info conflicts with old, the older fact is **superseded, not deleted** (kept as history).
- **Reinforcement** — repeating an existing fact bumps confidence; repeating a relationship strengthens it.
- **Hybrid search** across names, aliases, attributes, and raw note text — driven by URL search params so it's shareable.
- **Natural-language Q&A** over your graph: *"Who works at TCS?"*, *"Who is Aarav dating?"*
- **Web enrichment** with Tavily — pull public info about a person's company / school / role and merge it as low-confidence attributes.
- **Interactive force-directed graph** of everyone you know.
- **Per-person timeline** of every note that ever mentioned them.

---

## Tech stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 (CSS-first config) with a custom dark design system
- **Database**: Postgres via [`@neondatabase/serverless`](https://www.npmjs.com/package/@neondatabase/serverless) — works on Vercel/Neon native, standalone Neon, Supabase, or any Postgres connection string
- **LLM**: Groq (default model: `llama-3.3-70b-versatile`)
- **Web search**: Tavily
- **Validation**: Zod (LLM JSON output)
- **Visualization**: react-force-graph-2d

---

## Project structure

```
SecondBrain/
├── app/                              <- Next.js App Router
│   ├── layout.tsx                    Root layout: sidebar + theme + banners
│   ├── globals.css                   Tailwind v4 + custom dark theme
│   ├── page.tsx                      / (Capture)
│   ├── actions.ts                    All server actions (ingest, enrich, ask, mutations)
│   ├── people/
│   │   ├── page.tsx                  /people  (server component)
│   │   └── [id]/
│   │       ├── page.tsx              /people/:id (server component)
│   │       └── not-found.tsx
│   ├── search/page.tsx               /search?q=…
│   ├── ask/page.tsx                  /ask
│   ├── graph/page.tsx                /graph
│   └── _components/                  client islands (forms, interactive widgets)
├── components/                       shared components (Sidebar, Avatar, banners)
├── lib/                              backend logic — pure TS, framework-agnostic
│   ├── config.ts                     env config
│   ├── types.ts                      domain types
│   ├── db/                           Postgres connection + schema migration
│   ├── llm/                          Groq, Tavily, extract / summarize / qa / enrich
│   ├── repos/                        DB access (one file per table)
│   ├── services/                     ingest, search, graph, qa, enrich pipelines
│   └── utils/names.ts                normalization + fuzzy match
├── scripts/migrate.ts                manual schema migrate (rarely needed)
├── .env.local                        your secrets (gitignored)
├── .env.example                      template
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── package.json
└── README.md
```

---

## 1. Local development

### Prerequisites

- Node.js 18+
- A Groq API key — [console.groq.com](https://console.groq.com)
- A Tavily API key (optional but recommended) — [app.tavily.com](https://app.tavily.com)
- A Postgres database. Fastest path: a free Neon project — [neon.tech](https://neon.tech).

### Setup

```bash
git clone <this-repo>
cd SecondBrain
npm install
```

Copy `.env.example` to `.env.local` and fill it in:

```bash
GROQ_API_KEY=gsk_...                                         # required
GROQ_MODEL=llama-3.3-70b-versatile                           # optional

TAVILY_API_KEY=tvly-...                                      # optional, enables enrichment

POSTGRES_URL=postgres://user:pass@host/dbname?sslmode=require  # required
```

### Run it

```bash
npm run dev
```

Open <http://localhost:3000>. The schema is created lazily on the first request that needs it.

---

## 2. Deploy to Vercel

### Option A — One-click via the Vercel dashboard

1. **Push this repo to GitHub.**
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. **Connect a Postgres database** — in the project's Storage tab, click *Connect Database* and pick **Neon** (Vercel-managed).
   This automatically populates `POSTGRES_URL` and aliases (`DATABASE_URL`, `POSTGRES_PRISMA_URL`) into your project env.
4. In *Settings → Environment Variables*, add:
   - `GROQ_API_KEY` — your Groq key
   - `TAVILY_API_KEY` — your Tavily key (optional)
   - `GROQ_MODEL` — optional override
5. Click **Deploy**. Done.

Next.js is auto-detected — no `vercel.json` is needed.

### Option B — From the CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel env add GROQ_API_KEY     # paste, choose all envs
vercel env add TAVILY_API_KEY   # optional
# Connect a Postgres store from the Vercel dashboard, then:
vercel env pull .env.local      # pulls POSTGRES_URL etc. locally
vercel deploy --prod
```

---

## How ingestion works

```
note text  ──────────────────────────────────► server action `ingestAction`
                                                       │
                                                       ▼
                              [ Capture ]    save raw note to Postgres
                                                       │
                                                       ▼
                              [ Interpret ] Groq returns strict JSON:
                                                       │  - people: [{ name, aliases, attributes }]
                                                       │  - relationships: [{ from, to, type, label, confidence }]
                                                       ▼
                              [ Connect ]   fuzzy-match each name against existing people
                                                       │  (normalized name → alias table → Levenshtein fallback)
                                                       ▼
                              [ Update ]    upsert attributes (preserving history on conflicts)
                                                       │  upsert relationships (reinforce or create both directions)
                                                       │  record note → person mentions for the timeline
                                                       ▼
                              [ Summarize ] regenerate the per-person profile summary
                                                       │
                                                       ▼
                              [ Retrieve ]  pages re-fetch via `revalidatePath`
```

## Web enrichment (Tavily)

On any profile page, click **Enrich** to:

1. Generate a search query from the person's professional attributes (e.g. `"Software Engineer at TCS"`).
2. Send it to Tavily for top web snippets.
3. Have Groq propose new attributes grounded in those snippets — only public, factual things tied to the company / school / role.
4. Merge them as **low-confidence** attributes (0.3–0.7) so they don't override anything you wrote yourself.
5. Regenerate the summary.

You can also pass a **custom query** (e.g. just `"TCS"` or `"AIIMS Delhi"`) for finer control.

## Data model

```
people          ── the nodes
person_aliases  ── known alternative names ("Aar", "Aarav K")
attributes      ── { person, category, key, value, confidence, source_note }
                   (older values are superseded_by → newer rows; never deleted)
relationships   ── directed edges with type, label, confidence, reinforcement_count
notes           ── every raw note submitted
note_mentions   ── links notes to the people they mention (powers timelines)
summaries       ── cached LLM summary per person
```

---

## Architecture notes

- **Server components fetch directly from Postgres** for initial render — no client-side `fetch` for the home, people, profile, search, or graph pages. The HTML you see is the real data, hydrated only where interactivity is needed.
- **Mutations go through server actions** in `app/actions.ts`. They use Next's `revalidatePath` so the affected pages refresh instantly without manual cache busting.
- **Client islands** live in `app/_components/`: the capture form (`useActionState`), the search input (debounced URL push), the enrich panel (`useActionState`), the ask panel, and the graph canvas.
- **`react-force-graph-2d`** is loaded on mount with a plain `import()` inside `useEffect` — Turbopack keeps it out of any server bundle that way.
- **Schema migrations** run lazily on the first request that hits the DB (`ensureSchema()`); idempotent and safe to ship as-is. You can also run `npm run db:migrate` explicitly.

---

## Where your data lives

In your Postgres database (Vercel-managed Neon, your own Neon, Supabase, etc.).

To wipe everything and start fresh:

```sql
DROP TABLE IF EXISTS summaries, note_mentions, attributes, relationships, notes, person_aliases, people CASCADE;
```

---

## Roadmap ideas

- Full-text search via Postgres `tsvector` for faster note search at scale.
- Embedding-based semantic search with `pgvector`.
- Bulk import from messages / journals.
- Weekly digest: "Who haven't you talked about in a while?"
- Export to Obsidian / JSON.
- Browser extension to capture notes from anywhere.
