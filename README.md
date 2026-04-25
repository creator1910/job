# $JOB

Bloomberg terminal-style career analysis. Enter your employer and role, get a BUY / HOLD / SELL / SHORT verdict backed by live web research.

## Stack

- React + Vite + TypeScript
- Anthropic Claude (streaming verdict + signals)
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
VITE_ANTHROPIC_KEY=
VITE_TAVILY_KEY=
VITE_MOCK=false        # set true to skip API calls
```
