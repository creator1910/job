# $JOB — Career Market Analysis

> Bloomberg-terminal aesthetics applied to your career. Enter your employer and role, and `$JOB` returns a **BUY · HOLD · SELL · SHORT** verdict on whether you should keep that seat — backed by live web research and source-grounded signals.

Built for the **Big Berlin Hack**.

---

## Hackathon partner technologies

`$JOB` is built on **three Big Berlin Hack partner technologies**, each load-bearing for a different layer of the product:

| # | Partner | What it powers in `$JOB` | Where in code |
|---|---|---|---|
| 1 | **Lovable** | Initial UI scaffold + deployment substrate. The first React/Vite/Tailwind skeleton, route shell, and design-system primitives were generated and iterated on with Lovable, then refined in this repo. | Whole-app baseline (router, Tailwind config, base components, deploy target) |
| 2 | **Google AI Studio (Gemini 2.5 Flash)** | **Primary LLM** — runs the verdict engine, structured signals, analyst notes, and the Advisor Chat. Used via Gemini's `streamGenerateContent` SSE endpoint with function-calling for the `career_verdict` schema. | `callGoogle()`, `chatWithGoogle()`, `GEMINI_VERDICT_SCHEMA` in `src/lib/analyze.ts` |
| 3 | **Tavily Search API** | The whole evidence layer. We fan out **8 parallel bucket-tagged web searches** (company, employer news, role demand, role market, layoff risk, compensation, strategic upside, broad fallback), dedupe + rank, and feed the brief into Gemini. | `streamResearch()` in `src/lib/analyze.ts` |

> **A note on the Anthropic fallback.** In production we'd lead with **Google Gemini** as designed. For live demo reliability — Gemini's free-tier rate limits and the occasional empty-`functionCall` round-trip can stall a 60-second pitch — we shipped an interchangeable **Anthropic Claude (Haiku 4.5)** path behind the same `getAIProvider()` switch. Both paths emit the identical `Verdict` shape; the only thing that changes is `VITE_AI_PROVIDER`. For the jury / demo session we run the Anthropic provider; the Gemini path is fully implemented and the recommended production default.

---

## Table of contents

1. [What it does](#what-it-does)
2. [Live demo / quick start](#live-demo--quick-start)
3. [Tech stack](#tech-stack)
4. [Architecture](#architecture)
5. [Setup & installation](#setup--installation)
6. [Environment variables](#environment-variables)
7. [Running modes](#running-modes)
8. [APIs & external services](#apis--external-services)
9. [Project layout](#project-layout)
10. [Key flows](#key-flows)
11. [Theming & design system](#theming--design-system)
12. [Scripts](#scripts)
13. [Switching AI providers](#switching-ai-providers)
14. [Mock mode (offline demo)](#mock-mode-offline-demo)
15. [Limitations & known constraints](#limitations--known-constraints)

---

## What it does

`$JOB` reframes the question *"should I stay in my job?"* as a market trade. The user supplies an employer + role; the app:

1. Fans out **8 parallel web searches** via Tavily across distinct evidence buckets (company, employer news, role demand, role market, layoff risk, compensation, strategic upside, broad fallback).
2. Streams sources into the UI as they land, then dedupes + ranks them.
3. Sends the curated research brief to the configured LLM (**Anthropic Claude** or **Google Gemini**) which returns:
   - a **structured verdict** (BUY / HOLD / SELL / SHORT) with conviction 50–99,
   - 3–5 short directional **signals** (each with a source URL),
   - a one-sentence **headline summary** (≤ 8 words),
   - a streamed **analyst note** (bold headline + 3 interpretive bullets + flip-condition).
4. Renders the verdict on a terminal-styled page with an **Advisor Chat** that answers single-sentence follow-ups grounded in the verdict context.

---

## Live demo / quick start

```sh
git clone <this-repo>
cd job
cp .env.example .env          # add your keys (or leave empty and use mock mode)
bun install                   # or: npm install / pnpm install
bun run dev                   # http://localhost:8080
```

For a no-key offline demo, leave `VITE_MOCK` blank or set `VITE_MOCK=true` in `.env` and run `bun run dev`. The app will replay a deterministic Meta SWE scenario.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| **Build** | [Vite 5](https://vitejs.dev/) + [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) | Fast HMR, SWC for JSX |
| **Language** | TypeScript 5.8 | Type-safe verdict + signal contracts shared across UI + API layer |
| **UI** | React 18 + React Router 6 | SPA with three routes: `/`, `/loading`, `/verdict` |
| **Styling** | Tailwind 3 + inline styles + theme context | Tokenized colors via `useTheme()` → light/dark switch persisted in `localStorage` |
| **Markdown** | [react-markdown](https://github.com/remarkjs/react-markdown) | Renders streamed analyst notes & chat replies |
| **LLM (primary)** | [Google Gemini 2.5 Flash](https://ai.google.dev/) — Big Berlin Hack partner | Function-calling for the structured `career_verdict` object, SSE streaming for the analyst note |
| **LLM (demo fallback)** | [Anthropic Claude Haiku 4.5](https://docs.anthropic.com/) | Same `Verdict` contract via tool-use; chosen for live-demo stability when Gemini is rate-limited |
| **LLM SDKs** | Raw `fetch` for Gemini's `streamGenerateContent` SSE endpoint + [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk) (browser-direct) | Single-binary, no backend |
| **Web research** | [Tavily Search API](https://docs.tavily.com/) — Big Berlin Hack partner | LLM-friendly results with snippets + bucket-tagged queries |
| **Initial scaffold + deploy** | [Lovable](https://lovable.dev/) — Big Berlin Hack partner | Generated the Vite + React + Tailwind baseline and the deploy substrate; iteratively refined here |
| **Background visual** | Custom `InfiniteGrid` canvas component | Cycles a tinted grid in the verdict color |
| **Fonts** | Space Mono + system mono fallback | Terminal aesthetic |
| **Lint** | ESLint 9 (typescript-eslint, react-hooks, react-refresh) | `bun run lint` |

The app is **fully client-side**. There is no server. All API calls (Tavily, Claude, Gemini) are issued from the browser using `dangerouslyAllowBrowser: true` for the Anthropic SDK. This is deliberate for the hackathon scope; in production, the keys would move behind a proxy.

---

## Architecture

```
                   ┌──────────────────────────┐
                   │      User (browser)      │
                   └──────────────┬───────────┘
                                  │ employer + role
                                  ▼
                   ┌──────────────────────────┐
                   │     Home.tsx (form)      │
                   └──────────────┬───────────┘
                                  │ navigate("/loading", state)
                                  ▼
            ┌─────────────────────────────────────────┐
            │           Loading.tsx                   │
            │  └─ analyzePosition(employer, role,     │
            │       onProgress)  ── from analyze.ts   │
            └────┬───────────────────────────┬────────┘
                 │ 8× parallel Tavily searches│
                 │ (company, employer, role,  │
                 │  role_market, risk, market,│
                 │  upside, broad)            │
                 ▼                            │
       ┌──────────────────┐                   │
       │ Tavily Search API│                   │
       └────────┬─────────┘                   │
                │ ranked, deduped sources     │
                ▼                             │
       ┌──────────────────────────────────────┘
       │ research brief + sources
       ▼
┌───────────────────────────────────────────┐
│  Provider switch (VITE_AI_PROVIDER):      │
│   ├─ "google"    → Gemini 2.5 Flash  ★    │
│   │     (functionCall: career_verdict     │
│   │      or responseSchema fallback)      │
│   │      ── primary, partner technology   │
│   └─ "anthropic" → Claude Haiku 4.5       │
│         (tool_use: career_verdict)        │
│         ── interchangeable demo fallback  │
└──────────────┬────────────────────────────┘
               │ streamed analyst tokens + structured Verdict
               ▼
       navigate("/verdict", { verdict, sources, researchText })
               │
               ▼
       ┌──────────────────────────┐
       │      Verdict.tsx         │
       │  - Hero panel (verdict)  │
       │  - Signals (↑ / ↓ cols)  │
       │  - Analyst notes panel   │
       │  - Advisor Chat panel ◄──┐
       └──────────────────────────┘ │
                                    │ chatWithVerdictAI()
                                    │ (single-sentence advisor,
                                    │  same provider switch)
                                    └──────────────────────────
```

**Single source of truth**: `src/lib/analyze.ts` owns the verdict schema, both provider implementations, the research-brief assembly, the fallback analyst note, and the advisor-chat prompts. `Verdict.tsx` and `Loading.tsx` just consume it.

---

## Setup & installation

### Prerequisites

- **Node.js ≥ 20** (or **Bun ≥ 1.1** — the lockfile is `bun.lock`)
- API keys (see next section). Skip if running in mock mode.

### Steps

```sh
# 1. Clone
git clone <this-repo>
cd job

# 2. Install deps
bun install                    # preferred (lockfile is bun.lock)
# or:
npm install
# or:
pnpm install

# 3. Configure environment
cp .env.example .env
# edit .env with your keys (see below)

# 4. Run
bun run dev                    # → http://localhost:8080
```

### Build for production

```sh
bun run build                  # outputs to dist/
bun run preview                # serve dist/ locally
```

---

## Environment variables

All variables are read from `.env` by Vite (must be `VITE_`-prefixed to be exposed to the browser).

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `VITE_AI_PROVIDER` | yes | `anthropic` | `google` or `anthropic` — picks the LLM backend |
| `VITE_JOB_API_URL` | production | — | Public Edge Function URL, e.g. `https://<project>.supabase.co/functions/v1/job-ai` |
| `VITE_SUPABASE_URL` | production fallback | — | Used to derive the `job-ai` function URL when `VITE_JOB_API_URL` is blank |
| `VITE_SUPABASE_ANON_KEY` | if function requires JWT | — | Public Supabase anon key; not a provider secret |
| `VITE_ANTHROPIC_KEY` | if provider = anthropic | — | Anthropic API key |
| `VITE_ANTHROPIC_MODEL` | no | `claude-haiku-4-5-20251001` | Any Anthropic model id with tool-use support |
| `VITE_GOOGLE_KEY` | if provider = google | — | Google AI Studio (Gemini) API key |
| `VITE_GOOGLE_MODEL` | no | `gemini-2.5-flash` | Any Gemini model id with function-calling + streaming |
| `VITE_TAVILY_KEY` | yes (live mode) | — | Tavily Search API key — required for the 8 research queries |
| `VITE_MOCK` | no | auto | If blank, missing keys fall back to the built-in mock verdict; `true` always mocks; `false` forces live APIs |

`.env.example` ships with sensible defaults; only the three secrets need to be filled in.

---

## Running modes

| Mode | How | What happens |
|---|---|---|
| **Live (Anthropic)** | `VITE_AI_PROVIDER=anthropic` + key | Tavily research + Claude Haiku verdict |
| **Live (Google)** | `VITE_AI_PROVIDER=google` + key | Tavily research + Gemini 2.5 Flash verdict |
| **Mock** | `VITE_MOCK=true` or missing live keys with blank `VITE_MOCK` | Replays Meta-SWE scenario; no network calls; useful for demos and judges without keys |

### Lovable deploy note

For a real public deployment, use the Edge Function in `supabase/functions/job-ai`. Store these private secrets in Lovable/Supabase Cloud secrets, not frontend env:

| Secret | Purpose |
|---|---|
| `TAVILY_KEY` | Tavily Search API key |
| `GOOGLE_KEY` | Google AI Studio key |
| `GOOGLE_MODEL` | Optional, defaults to `gemini-2.5-flash` |

Then set one public frontend variable:

```sh
VITE_JOB_API_URL=https://<project>.supabase.co/functions/v1/job-ai
```

If Lovable injects `VITE_SUPABASE_URL`, the frontend can derive the same URL automatically. Do not put private provider keys directly in frontend `VITE_*` variables unless you accept that they are visible in the browser bundle. Lovable's current guidance is to store sensitive credentials in **Cloud -> Secrets** and access them through Edge Functions, not client-side code.

---

## APIs & external services

### 1. Tavily Search API

- **Endpoint**: `POST https://api.tavily.com/search`
- **Used in**: `streamResearch()` in `src/lib/analyze.ts`
- **Pattern**: 8 parallel `Promise.allSettled` searches, each tagged with a *bucket* (`company`, `employer`, `role`, `role_market`, `risk`, `market`, `upside`, `broad`). Results are deduped by URL, then a one-per-bucket round-robin runs first to guarantee evidence diversity, then the remaining slots are filled by score until a bucket-aware cap (4–16 sources depending on raw result count).
- **Why**: returns LLM-friendly snippets and an aggregated answer; one quota covers all 8 queries.

### 2. Google Generative Language API (Gemini) — primary LLM, partner technology

- **Endpoint**: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse`
- **Fallback**: `:generateContent` with `responseMimeType: application/json` + `responseSchema` if the streamed function call doesn't materialize.
- **Used in**: `callGoogle()` (verdict) and `chatWithGoogle()` (advisor)
- **Pattern**: SSE streaming; reads `functionCall.career_verdict` from candidate parts, with a JSON-schema fallback path. `GEMINI_VERDICT_SCHEMA` mirrors `VERDICT_SCHEMA` in Gemini's typed format.
- **Model**: configurable; defaults to `gemini-2.5-flash`.

### 3. Anthropic Messages API — interchangeable demo fallback

- **Endpoint**: `POST https://api.anthropic.com/v1/messages` (via `@anthropic-ai/sdk` browser client with `dangerouslyAllowBrowser: true`)
- **Used in**: `callClaude()` (verdict) and `chatWithClaude()` (advisor)
- **Pattern**: Streaming response, **tool-use** with the `career_verdict` tool whose schema is defined in `VERDICT_SCHEMA`. The model first writes the analyst note as plain text (which we stream into the UI), then emits the structured tool call.
- **Model**: configurable; defaults to `claude-haiku-4-5-20251001`.
- **Why we ship it**: Gemini's free-tier rate limits and occasional empty-`functionCall` round-trips can stall a 60-second pitch. Claude Haiku 4.5 hits the same `Verdict` shape with lower demo variance, so we route through it during live presentations. Production default returns to Gemini.

### 4. Verdict schema (shared contract)

```ts
interface Verdict {
  verdict: "BUY" | "HOLD" | "SELL" | "SHORT";
  conviction: number;           // 50–99: signal strength, not probability
  signals: {
    direction: "up" | "down";
    text: string;               // 6–12 word fragment, single clause
    url?: string;               // citation when grounded in a source
  }[];                          // 3–5 items
  summary: string;              // ≤ 8 words, one punchy sentence
}
```

Both providers are forced into this shape via tool / function declarations. The same schema is used by `chatWithVerdictAI()` to render context for the advisor chat.

---

## Project layout

```
src/
├── App.tsx                         # Router + ThemeProvider
├── main.tsx                        # Vite entry
├── index.css                       # Tailwind base + a few utilities
│
├── pages/
│   ├── Home.tsx                    # Employer + role form
│   ├── Loading.tsx                 # Streaming progress (sources + analysis)
│   └── Verdict.tsx                 # Hero panel + signals + notes + advisor chat
│
├── components/
│   ├── Header.tsx                  # $JOB logo (color-bound to verdict) + theme toggle
│   └── ui/
│       └── the-infinite-grid.tsx   # Animated grid backdrop, tinted by verdict
│
├── lib/
│   ├── analyze.ts                  # ★ core: research + verdict + chat (~1100 LOC)
│   ├── theme.tsx                   # Light/dark color tokens + ThemeProvider context
│   └── utils.ts                    # cn() helper for class merging
│
└── hooks/
    └── use-overflow.ts             # useScrollFade(): top/bottom mask + scroll detection
```

`analyze.ts` is the only file that talks to external APIs. Everything else is presentation.

---

## Key flows

### A. Submit → verdict (Loading.tsx)

```ts
analyzePosition(employer, role, onProgress)
  → onProgress({ type: "searching" })
  → streamResearch(...)            // Tavily 8× parallel
      → onProgress({ type: "source_found", source }) ×N
  → onProgress({ type: "search_complete", sourceCount, sources })
  → onProgress({ type: "analyzing" })
  → callClaude / callGoogle(...)
      → onProgress({ type: "analysis_token", text }) ×N    // streaming analyst note
      → returns Verdict (structured)
  → navigate("/verdict", { verdict, sources, researchText })
```

### B. Verdict page

- **Hero panel**: ticker (`$EMPLOYER-ROLE`), source count, big verdict word with scramble animation, one-sentence summary (line-clamped to 2 rows). The hero panel and the signals share one bordered card.
- **Signals**: split into `↑ POSITIVE` and `↓ NEGATIVE` columns, each independently scrollable with top/bottom fade masks (`useScrollFade`).
- **Analyst notes**: a `ReactMarkdown` block rendering the streamed bold-headline + 3 interpretive bullets + italic flip-condition closer.
- **Sources**: collapsible list of every cited URL with hostname.
- **Advisor Chat**: streaming chat panel with 3 suggestion chips. Bound to the same provider via `chatWithVerdictAI()`. System prompt forces a one-sentence, terminal-headline-style answer (8–18 words, no hedging).

### C. Provider switch

```ts
function getAIProvider(): "anthropic" | "google" {
  return import.meta.env.VITE_AI_PROVIDER ?? "anthropic";
}
```

`callClaude` and `callGoogle` are interchangeable behind the same `(employer, role, researchContent, sources, onToken) → Promise<Verdict>` signature. Same for `chatWithClaude` / `chatWithGoogle`.

---

## Theming & design system

- `src/lib/theme.tsx` exports `ThemeProvider`, `useTheme()`, and a typed `Colors` token set.
- Two themes: **dark** (default) and **light**, persisted in `localStorage` under `job-theme`.
- `Colors.verdictColors` defines the BUY/HOLD/SELL/SHORT palette per theme. The `$` in the logo, the verdict word, the InfiniteGrid tint, and the chat send-button color all bind to `colors.verdictColors[verdict]`.
- All panels on the verdict page get a faint theme-aware fill (`rgba(0,0,0,0.18)` dark / `0.006` light) and a 1px border in `colors.border`.

---

## Scripts

```sh
bun run dev          # Vite dev server on :8080 with HMR
bun run build        # Production build → dist/
bun run build:dev    # Build with development mode (sourcemaps, no minify)
bun run preview      # Serve dist/ locally
bun run lint         # ESLint across the repo
```

---

## Switching AI providers

The provider is selected at runtime via `VITE_AI_PROVIDER`. Both code paths are always present in the bundle.

```sh
# Production default — Big Berlin Hack partner
VITE_AI_PROVIDER=google
VITE_GOOGLE_KEY=AIza...
VITE_GOOGLE_MODEL=gemini-2.5-flash

# Demo / fallback — interchangeable, same Verdict contract
VITE_AI_PROVIDER=anthropic
VITE_ANTHROPIC_KEY=sk-ant-...
VITE_ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

If you change provider, rerun `bun run dev` so Vite re-reads `.env`.

---

## Mock mode (offline demo)

Set `VITE_MOCK=true` to bypass all network calls. The app will:

- Replay 12 mocked Meta sources with a 350ms cadence so the streaming UI looks identical to live mode.
- Stream a fixed analyst note (~95 words).
- Return a deterministic `MOCK_VERDICT` (HOLD with 7 signals, mixed direction).

This is the recommended mode for **judges without API keys** and for taking screenshots / video.

---

## Limitations & known constraints

- **Browser-direct API keys**. Quick wins for a hackathon, dangerous for production. Move keys behind a proxy before public deployment.
- **No persistence**. Verdicts live in `react-router` location state; refreshing the `/verdict` page redirects home.
- **Single search provider**. Tavily covers most domains well, but role-specific data (Levels.fyi, Glassdoor) is sometimes thin; the `getSourceLimit()` heuristic adapts but can't fix sparse evidence.
- **One-shot analysis**. The verdict is computed once; the Advisor Chat then reasons over the cached context. No follow-up re-research.
- **Rate limits**. Eight parallel Tavily queries + a Claude/Gemini stream per analysis. Stay within free-tier quotas during demos.

---

## License

Built for the Big Berlin Hack. All third-party dependencies retain their respective licenses (see `package.json`).
