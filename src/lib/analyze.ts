import Anthropic from "@anthropic-ai/sdk";

export interface Signal {
  direction: "up" | "down";
  text: string;
  url?: string;
}

export interface Verdict {
  verdict: "BUY" | "HOLD" | "SELL" | "SHORT";
  conviction: number;
  signals: Signal[];
  summary: string;
}

export interface TavilySource {
  title: string;
  url: string;
  content: string;
}

export type ProgressStep =
  | { type: "searching" }
  | { type: "source_found"; source: TavilySource }
  | { type: "search_complete"; sourceCount: number; sources: TavilySource[] }
  | { type: "analyzing" }
  | { type: "analysis_token"; text: string };

const SYSTEM_PROMPT = `You are a brutally honest career investment analyst. You give verdicts, not advice.

VERDICT DEFINITIONS:
- BUY: Strong demand for this role at this employer. Growing org, increasing leverage, above-market trajectory. Hold and accumulate more career capital here.
- HOLD: Stable but not exciting. Acceptable risk. No urgent action required. Reassess in 12 months.
- SELL: Declining trajectory. Better opportunities exist elsewhere. Begin positioning for exit.
- SHORT: Actively destroying career capital. Layoffs, AI displacement, org dysfunction, or strategic collapse in progress. Exit immediately.

RULES:
- First, write 2-3 sentences of raw analysis: what you're seeing in the data, the key signal, why you're leaning the direction you are. Be specific — company names, numbers, dates.
- Then call career_verdict with your structured output.
- Never hedge. Never say "it depends." Give a verdict.
- Never be balanced. Take a position.
- Your signals must be specific: numbers, dates, executive names, product names. No vague sentiment.
- Weigh company health, recent news, hiring activity, and momentum signals. Weight recent signals over older ones.
- If a signal is grounded in a provided source, include that source's URL in the "url" field. Otherwise omit "url".`;

const VERDICT_TOOL: Anthropic.Tool = {
  name: "career_verdict",
  description: "Output the career investment verdict as structured data.",
  input_schema: {
    type: "object" as const,
    properties: {
      verdict: { type: "string", enum: ["BUY", "HOLD", "SELL", "SHORT"] },
      conviction: { type: "integer", description: "Conviction percentage 50-99" },
      signals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            direction: { type: "string", enum: ["up", "down"] },
            text: { type: "string", description: "Specific signal with concrete data" },
            url: { type: "string", description: "Source URL if grounded in research" },
          },
          required: ["direction", "text"],
        },
        minItems: 3,
        maxItems: 5,
      },
      summary: { type: "string", description: "One punchy sentence, max 12 words" },
    },
    required: ["verdict", "conviction", "signals", "summary"],
  },
};

const TAVILY_KEY = () => import.meta.env.VITE_TAVILY_KEY as string;

// Domains considered authoritative for career/company research
const QUALITY_DOMAINS = [
  "techcrunch.com", "bloomberg.com", "wsj.com", "ft.com", "reuters.com",
  "cnbc.com", "forbes.com", "businessinsider.com", "theverge.com", "wired.com",
  "nytimes.com", "washingtonpost.com", "axios.com", "fortune.com",
  "linkedin.com", "glassdoor.com", "levels.fyi", "layoffs.fyi",
  "crunchbase.com", "pitchbook.com", "sec.gov", "ir.", "investor.",
];

function isQualitySource(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    return QUALITY_DOMAINS.some((d) => host.includes(d));
  } catch {
    return false;
  }
}

async function streamResearch(
  employer: string,
  role: string,
  onSource: (source: TavilySource) => void
): Promise<{ content: string; sources: TavilySource[] }> {
  const input = `Should I keep working for ${employer} in the role ${role}?`;

  const res = await fetch("https://api.tavily.com/research", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TAVILY_KEY()}`,
    },
    body: JSON.stringify({ input, model: "mini", stream: true }),
  });

  if (!res.ok) throw new Error(`Research failed: ${res.status}`);

  const seenUrls = new Set<string>();
  const sources: TavilySource[] = [];
  let content = "";

  // Parse SSE stream
  // Event format: choices[0].delta.{content?, tool_calls?}
  // Sources appear in tool_calls.tool_response[].sources when name==="WebSearch"
  // Synthesized report streams via choices[0].delta.content
  if (res.headers.get("content-type")?.includes("text/event-stream") && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;

        let event: Record<string, unknown>;
        try { event = JSON.parse(raw); } catch { continue; }

        const delta = (event.choices as Array<{ delta: Record<string, unknown> }>)?.[0]?.delta;
        if (!delta) continue;

        // Synthesized report content (streams word by word)
        if (typeof delta.content === "string" && delta.content) {
          content += delta.content;
        }

        // Sources inside WebSearch tool_response events
        const tc = delta.tool_calls as { type?: string; tool_response?: Array<{ name?: string; sources?: Array<{ title?: string; url: string }> }> } | undefined;
        if (tc?.type === "tool_response" && tc.tool_response) {
          for (const resp of tc.tool_response) {
            if (resp.name !== "WebSearch" || !resp.sources) continue;
            for (const s of resp.sources) {
              if (!s.url || seenUrls.has(s.url)) continue;
              if (!isQualitySource(s.url)) continue;
              seenUrls.add(s.url);
              const src: TavilySource = { title: s.title ?? s.url, url: s.url, content: "" };
              sources.push(src);
              onSource(src);
            }
          }
        }
      }
    }
  } else {
    // Non-streaming fallback
    const data = await res.json();
    const rawSources = (data.sources ?? data.results ?? []) as Array<{ title?: string; url: string }>;
    for (const s of rawSources) {
      if (!s.url || seenUrls.has(s.url)) continue;
      if (!isQualitySource(s.url)) continue;
      seenUrls.add(s.url);
      const src: TavilySource = { title: s.title ?? s.url, url: s.url, content: "" };
      sources.push(src);
      onSource(src);
    }
    content = (data.content ?? data.report ?? data.answer ?? "") as string;
  }

  return { content, sources };
}

async function callClaude(
  employer: string,
  role: string,
  researchContent: string,
  sources: TavilySource[],
  onToken: (text: string) => void
): Promise<Verdict> {
  const client = new Anthropic({
    apiKey: import.meta.env.VITE_ANTHROPIC_KEY,
    dangerouslyAllowBrowser: true,
  });

  const sourceList = sources.length
    ? sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`).join("\n")
    : "No sources available.";

  const stream = client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [VERDICT_TOOL],
    tool_choice: { type: "auto" },
    messages: [{
      role: "user",
      content: `Employer: ${employer}
Role: ${role}

RESEARCH (most recent signals first):
${researchContent}

SOURCES:
${sourceList}

Give your verdict.`,
    }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta" &&
      event.delta.text
    ) {
      onToken(event.delta.text);
    }
  }

  const message = await stream.finalMessage();
  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("No tool use in response");

  const parsed = toolUse.input as Verdict;
  parsed.conviction = Math.min(99, Math.max(50, parsed.conviction));
  return parsed;
}

// ── Mock ────────────────────────────────────────────────────────────────────

const MOCK_SOURCES: TavilySource[] = [
  { title: "Meta lays off 3,600 in performance cuts — largest since 2022", url: "https://techcrunch.com/mock1", content: "" },
  { title: "Meta Q1 2025 earnings: revenue $36.4B, up 16% YoY", url: "https://wsj.com/mock2", content: "" },
  { title: "Meta SWE hiring down 40% as AI automation expands", url: "https://bloomberg.com/mock3", content: "" },
  { title: "Meta open roles at 3-year low per LinkedIn data", url: "https://linkedin.com/mock4", content: "" },
];

const MOCK_VERDICT: Verdict = {
  verdict: "SHORT",
  conviction: 87,
  signals: [
    { direction: "down", text: "3,600 layoffs in Q1 2025 targeting mid-level SWE; performance review window expanded to 18 months", url: "https://techcrunch.com/mock1" },
    { direction: "down", text: "SWE open roles down 40% YoY; AI automation cited directly in Zuckerberg's Q1 letter", url: "https://bloomberg.com/mock3" },
    { direction: "up", text: "Compensation still top-decile — golden handcuffs, not career capital" },
  ],
  summary: "Exit now. The stock is falling and you're holding.",
};

// ── Public API ───────────────────────────────────────────────────────────────

export async function analyzePosition(
  employer: string,
  role: string,
  onProgress: (step: ProgressStep) => void
): Promise<Verdict> {
  if (import.meta.env.VITE_MOCK === "true") {
    onProgress({ type: "searching" });
    for (const src of MOCK_SOURCES) {
      await new Promise((r) => setTimeout(r, 350));
      onProgress({ type: "source_found", source: src });
    }
    onProgress({ type: "search_complete", sourceCount: MOCK_SOURCES.length, sources: MOCK_SOURCES });
    await new Promise((r) => setTimeout(r, 200));
    onProgress({ type: "analyzing" });
    const reasoning = "Revenue is strong at $36.4B but that doesn't translate to job security for SWEs. The layoffs pattern and hiring freeze tell the real story — automation is replacing headcount, not growing it. Profitable company, shrinking role.";
    for (const word of reasoning.split(" ")) {
      await new Promise((r) => setTimeout(r, 55));
      onProgress({ type: "analysis_token", text: word + " " });
    }
    await new Promise((r) => setTimeout(r, 300));
    return { ...MOCK_VERDICT };
  }

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Analysis timed out")), 180_000)
  );

  const work = async (): Promise<Verdict> => {
    onProgress({ type: "searching" });

    let researchContent = "";
    let sources: TavilySource[] = [];

    try {
      const result = await streamResearch(employer, role, (src) => {
        onProgress({ type: "source_found", source: src });
      });
      researchContent = result.content;
      sources = result.sources;
    } catch (e) {
      console.warn("[analyze] Tavily research failed (non-fatal):", e);
    }

    onProgress({ type: "search_complete", sourceCount: sources.length, sources });
    onProgress({ type: "analyzing" });

    return callClaude(employer, role, researchContent, sources, (text) => {
      onProgress({ type: "analysis_token", text });
    });
  };

  return Promise.race([work(), timeout]);
}
