# SecondBrain — A Personal People Knowledge Graph

A second brain focused on the **people** in your life.
Drop in messy natural-language notes; SecondBrain extracts the people, their attributes, and the relationships between them into a living, evolving graph that you can search, visualize, and query.

> Capture → Interpret → Connect → Update → Summarize → Retrieve

A single **Next.js 16** app — server components fetch data straight from Postgres, mutations run via server actions, no separate backend.
Built with **shadcn/ui**, **Tailwind v4**, **Neon Postgres**, **Groq**, and **Tavily**. Email/password authentication is built in; every user gets a fully isolated graph.

---

## Features

- **Email + password auth** with bcrypt-hashed passwords and JWT session cookies. Routes are gated by an edge proxy.
- **Per-user isolation** — every person, attribute, relationship, and note is scoped to the signed-in user. Two users can have a "John" who don't bleed into each other.
- **Capture** any messy note. Groq extracts people, attributes, and relationships in a single round-trip.
- **Fuzzy entity resolution** — never creates duplicate people for "John", "John Carter", or nicknames.
- **Evolving profiles** with auto-regenerated, human-feeling summaries per person.
- **Confidence tracking** on every fact (1.0 = stated, 0.4 = inferred, etc.).
- **Contradiction handling** — when new info conflicts with old, the older fact is **superseded, not deleted**.
- **Reinforcement** — repeating an existing fact bumps confidence; repeating a relationship strengthens it.
- **Hybrid search** across names, aliases, attributes, and raw note text.
- **Natural-language Q&A** over your graph: *"Who works at TCS?"*, *"Who is Aarav dating?"*
- **Web enrichment** with Tavily — pull public info about a person's company / school / role and merge it as low-confidence attributes.
- **Interactive force-directed graph** of everyone you know.
- **Per-person timeline** of every note that ever mentioned them.

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **shadcn/ui** with Base UI primitives, **Tailwind CSS v4** (CSS-first config), flat dark theme — no gradients
- **Postgres** via [`@neondatabase/serverless`](https://www.npmjs.com/package/@neondatabase/serverless) — Neon recommended
- **Auth**: bcryptjs (password hashing) + jose (JWT signing, edge-compatible for proxy)
- **LLM**: Groq, with a built-in **model fallback chain** — by default tries `openai/gpt-oss-120b` → `openai/gpt-oss-20b` → `openai/gpt-oss-safeguard-20b` → `llama-3.3-70b-versatile`, retrying each model up to 2x with backoff and skipping to the next on transport errors or malformed JSON
- **Web search**: Tavily
- **Visualization**: react-force-graph-2d
- **Validation**: Zod for LLM output

---

## Project structure

```
SecondBrain/
├── app/
│   ├── layout.tsx                    Root layout (font + Toaster only)
│   ├── globals.css                   Tailwind v4 + flat dark theme
│   ├── actions.ts                    Server actions (ingest, enrich, ask, mutations)
│   ├── auth-actions.ts               Auth actions (signin, signup, signout)
│   ├── (auth)/                       Public auth routes
│   │   ├── layout.tsx                Bare auth shell
│   │   ├── signin/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/                        Authenticated routes (sidebar shell)
│   │   ├── layout.tsx                requireUser() + Sidebar
│   │   ├── page.tsx                  / — Capture
│   │   ├── people/page.tsx
│   │   ├── people/[id]/page.tsx
│   │   ├── search/page.tsx
│   │   ├── ask/page.tsx
│   │   └── graph/page.tsx
│   └── _components/                  client islands
├── components/
│   ├── Sidebar.tsx                   Nav + user dropdown w/ sign-out
│   ├── Avatar.tsx                    flat-color initials avatar
│   ├── HealthBanners.tsx             config warnings
│   └── ui/                           shadcn primitives
├── lib/
│   ├── auth/                         password hashing + JWT sessions + getCurrentUser
│   ├── config.ts                     env config
│   ├── types.ts                      domain types
│   ├── db/                           Postgres client + schema migration
│   ├── llm/                          Groq, Tavily, extract / summarize / qa / enrich
│   ├── repos/                        DB access (every fn takes userId)
│   ├── services/                     ingest, search, graph, qa, enrich pipelines
│   ├── utils.ts                      shadcn `cn()` helper
│   └── utils/names.ts                fuzzy name match
├── proxy.ts                          edge proxy — gates all routes behind session
├── scripts/migrate.ts                explicit schema migration script
├── components.json                   shadcn config
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── package.json
└── README.md
```

---

## Local development

### Prerequisites

- Node.js 18+
- A **Groq** API key — [console.groq.com](https://console.groq.com)
- A **Tavily** API key (optional but recommended) — [app.tavily.com](https://app.tavily.com)
- A **Neon** Postgres database — [neon.tech](https://neon.tech) (free tier is plenty)

### Setup

```bash
git clone <this-repo>
cd SecondBrain
npm install
```

Copy `.env.example` to `.env.local` and fill it in:

```bash
GROQ_API_KEY=gsk_...                                         # required
# GROQ_MODEL=                                                # optional, pins a single model (disables fallback)
# GROQ_MODELS=openai/gpt-oss-120b,llama-3.3-70b-versatile    # optional, override the chain

TAVILY_API_KEY=tvly-...                                      # optional, enables enrichment

POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require  # required
AUTH_SECRET=<at least 32 chars>                              # required
```

> **Model fallback**: by default the app tries `openai/gpt-oss-120b` first, then `openai/gpt-oss-20b`, `openai/gpt-oss-safeguard-20b`, and finally `llama-3.3-70b-versatile`. Each model is retried up to 2x with exponential backoff. If a model returns malformed JSON for ingestion or enrichment, the chain immediately advances to the next model. See `lib/llm/groq.ts` for the runner.

Generate an `AUTH_SECRET`:

```bash
# macOS / Linux:
openssl rand -base64 48

# PowerShell:
[Convert]::ToBase64String((1..48 | ForEach-Object { [byte](Get-Random -Maximum 256) }))
```

### Apply the schema (optional — done automatically on first request)

```bash
npm run db:migrate
```

### Run it

```bash
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to **/signin** — create an account at **/signup**.

---

## Deploying to Vercel — step by step

### 1. Push to GitHub

If you haven't yet:

```bash
git add .
git commit -m "feat: shadcn UI, neon db, auth"
git push
```

### 2. Import the repo into Vercel

- Go to [vercel.com/new](https://vercel.com/new).
- Click **"Import Git Repository"** and pick your repo.
- Vercel auto-detects **Next.js** — leave all build settings on defaults (don't override the build command or output directory).

### 3. Connect your Neon database

You have two options.

**Option A: Use the existing Neon project (this one).**

1. Open the imported project in Vercel.
2. Click **Settings → Environment Variables**.
3. Add `POSTGRES_URL` with your Neon connection string:
   ```
   postgresql://neondb_owner:npg_mZB1SRh8Just@ep-curly-mode-amjv48wt-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

**Option B: Connect a new Vercel-managed Neon store.**

1. In your Vercel project, click **Storage → Connect Database**.
2. Pick **Neon** under Marketplace.
3. Vercel automatically populates `POSTGRES_URL`, `DATABASE_URL`, and friends in your project env.

### 4. Add the rest of the environment variables

In **Settings → Environment Variables**, add (set scope to **Production**, **Preview**, and **Development**):

| Key              | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| `GROQ_API_KEY`   | `gsk_...` (your Groq key)                                          |
| `GROQ_MODEL`     | `llama-3.3-70b-versatile` (optional)                               |
| `TAVILY_API_KEY` | `tvly-...` (optional)                                              |
| `AUTH_SECRET`    | a 48-byte base64 string — **must be different from your dev one**  |

Generate a fresh `AUTH_SECRET` for production. **Never** reuse the dev one.

### 5. Deploy

Click **Deploy**. Vercel runs `next build`, which:

- compiles every route (including the `proxy.ts` edge function),
- skips connecting to Postgres at build time (lazy on first request).

You'll get a URL like `https://secondbrain.vercel.app`.

### 6. First sign-up

Visit your deployed URL → it redirects to `/signin` → click **"Create one"** → fill in email + password (≥ 8 chars). The schema is created automatically on this first request.

### Troubleshooting

- **"AUTH_SECRET is not set or is too short"** → add `AUTH_SECRET` (≥ 32 chars) in Settings → Environment Variables, then **Redeploy** the latest commit.
- **"POSTGRES_URL is not configured"** → connect a Neon store or paste the URL into env vars.
- **Sign-in fails immediately** → in Vercel logs, look for a Postgres connect error. Confirm the connection string includes `?sslmode=require`.

---

## How ingestion works

```
note text → ingestAction (server action, requireUser)
                │
                ▼
     [ Capture ]    save raw note (with user_id) to Postgres
                │
                ▼
     [ Interpret ] Groq returns strict JSON
                │  - people: [{ name, aliases, attributes }]
                │  - relationships: [{ from, to, type, label, confidence }]
                ▼
     [ Connect ]   fuzzy-match each name against the user's existing people
                │  (normalized name → alias table → Levenshtein fallback)
                ▼
     [ Update ]    upsert attributes (preserving history on conflicts)
                │  upsert relationships (reinforce or create both directions)
                │  record note → person mentions for the timeline
                ▼
     [ Summarize ] regenerate the per-person profile summary
                ▼
     [ Retrieve ]  pages re-fetch via revalidatePath
```

## Data model

```
users           ── owners
people          ── nodes (scoped to a user)
person_aliases  ── alternative names per person (scoped to a user)
attributes      ── { user, person, category, key, value, confidence, source_note }
                   older values are superseded_by → newer rows; never deleted
relationships   ── directed edges with type/label/reinforcement_count, scoped to a user
notes           ── raw input notes, scoped to a user
note_mentions   ── links notes to the people they mention
summaries       ── cached LLM summary per person
```

Every owned table has `user_id REFERENCES users(id) ON DELETE CASCADE`, so deleting a user removes their entire graph.

---

## Where your data lives

In your Neon Postgres database. Wipe everything and start fresh with:

```sql
DROP TABLE IF EXISTS summaries, note_mentions, attributes, relationships, notes, person_aliases, people, users CASCADE;
```

---

## Roadmap ideas

- Google OAuth in addition to email/password.
- Full-text search via Postgres `tsvector`.
- Embedding-based semantic search with `pgvector`.
- Bulk import from messages / journals.
- Weekly digest: "Who haven't you talked about in a while?"
