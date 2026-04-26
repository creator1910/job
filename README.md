# $JOB

Bloomberg terminal-style career analysis. Enter your employer and role, get a BUY / HOLD / SELL / SHORT verdict backed by live web research.

## Stack

- React + Vite + TypeScript
- Google Gemini or Anthropic Claude (streaming verdict + signals)
- Tavily (live web research)
- Space Mono — terminal aesthetic

## Setup

```sh
cp .env.example .env   # add your keys
bun install
bun run dev
```

## Environment

```
VITE_AI_PROVIDER=google  # google or anthropic
VITE_ANTHROPIC_KEY=
VITE_ANTHROPIC_MODEL=claude-haiku-4-5-20251001
VITE_TAVILY_KEY=
VITE_GOOGLE_KEY=
VITE_GOOGLE_MODEL=gemini-2.5-flash
VITE_MOCK=false        # set true to skip API calls
```
