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
- The conviction field is signal strength, not a probability. It should answer: "How strongly does the evidence support this exact verdict?" Use 50-64 for weak/mixed evidence, 65-79 for solid directional evidence, 80-89 for strong evidence with multiple concrete signals, and 90-99 only for overwhelming evidence from many recent authoritative sources.
- Always return 3-5 signals in career_verdict.signals. Do not return an empty signals array.
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
      conviction: { type: "integer", description: "Signal strength percentage 50-99: how strongly the evidence supports the verdict, not a probability" },
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

  let streamedAnalysis = "";

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
      streamedAnalysis += event.delta.text;
      onToken(event.delta.text);
    }
  }

  const message = await stream.finalMessage();
  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("No tool use in response");

  const parsed = toolUse.input as Verdict;
  if (!streamedAnalysis.trim()) {
    onToken(buildFallbackAnalystNote(parsed, researchContent, sources));
  }
  parsed.conviction = Math.min(99, Math.max(50, parsed.conviction));
  parsed.signals = normalizeSignals(parsed, researchContent, sources);
  return parsed;
}

function buildFallbackAnalystNote(
  verdict: Verdict,
  researchContent: string,
  sources: TavilySource[]
): string {
  const sourceContext = sources.slice(0, 3).map((source) => source.title).join(" ");
  const researchContext = researchContent.replace(/\s+/g, " ").trim();
  const context = researchContext || sourceContext || "The available source set is thin, so the verdict is driven by limited but directional evidence.";
  const trimmed = context.length > 420 ? `${context.slice(0, 417)}...` : context;
  return `${trimmed}\n\nStructured verdict: ${verdict.verdict}. Signal strength reflects how strongly the available evidence supports that call, not the probability of a future event.`;
}

function normalizeSignals(
  verdict: Verdict,
  researchContent: string,
  sources: TavilySource[]
): Signal[] {
  const existing = Array.isArray(verdict.signals)
    ? verdict.signals.filter((signal) => signal?.text?.trim())
    : [];

  if (existing.length >= 3) return existing.slice(0, 5);

  const fallbackDirection: Signal["direction"] =
    verdict.verdict === "BUY" || verdict.verdict === "HOLD" ? "up" : "down";

  const researchSentences = researchContent
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 45)
    .slice(0, 5);

  const sourceSignals = sources.slice(0, 5).map((source) => ({
    direction: fallbackDirection,
    text: source.title,
    url: source.url,
  }));

  const researchSignals = researchSentences.map((sentence) => ({
    direction: fallbackDirection,
    text: sentence.length > 220 ? `${sentence.slice(0, 217)}...` : sentence,
  }));

  const combined = [...existing, ...researchSignals, ...sourceSignals];
  const unique = combined.filter((signal, index, arr) =>
    arr.findIndex((candidate) => candidate.text === signal.text) === index
  );

  return unique.slice(0, 5);
}

// ── Mock ────────────────────────────────────────────────────────────────────

const MOCK_SOURCES: TavilySource[] = [
  { title: "Meta lays off 3,600 in performance cuts — largest since 2022", url: "https://techcrunch.com/mock1", content: "" },
  { title: "Meta Q1 2025 earnings: revenue $36.4B, up 16% YoY", url: "https://wsj.com/mock2", content: "" },
  { title: "Meta SWE hiring down 40% as AI automation expands", url: "https://bloomberg.com/mock3", content: "" },
  { title: "Meta open roles at 3-year low per LinkedIn data", url: "https://linkedin.com/mock4", content: "" },
  { title: "Meta reorganizes infrastructure teams around AI efficiency targets", url: "https://reuters.com/mock5", content: "" },
  { title: "Reality Labs losses widen while headcount planning tightens", url: "https://cnbc.com/mock6", content: "" },
  { title: "Engineering managers told to raise performance bar in 2025 cycle", url: "https://businessinsider.com/mock7", content: "" },
  { title: "Levels.fyi reports senior SWE compensation flattening after 2024 peak", url: "https://levels.fyi/mock8", content: "" },
  { title: "LinkedIn hiring data shows fewer backend and product engineering postings", url: "https://linkedin.com/mock9", content: "" },
  { title: "Investor memo emphasizes automation-driven operating leverage", url: "https://investor.fb.com/mock10", content: "" },
  { title: "Layoffs.fyi tracks renewed tech workforce reductions across big tech", url: "https://layoffs.fyi/mock11", content: "" },
  { title: "Meta expands internal AI coding tools across engineering org", url: "https://theverge.com/mock12", content: "" },
];

const MOCK_VERDICT: Verdict = {
  verdict: "SHORT",
  conviction: 87,
  signals: [
    { direction: "down", text: "3,600 layoffs in Q1 2025 targeted mid-level engineering and product teams, while the performance review window expanded to 18 months; that means the company is still profitable, but individual SWE job security is being repriced downward.", url: "https://techcrunch.com/mock1" },
    { direction: "down", text: "SWE open roles are down 40% YoY across backend, infrastructure, and product engineering; Meta is still hiring selectively, but the broad internal signal is fewer seats, higher bar, and more automation pressure.", url: "https://bloomberg.com/mock3" },
    { direction: "down", text: "Internal AI coding tools are being rolled out across engineering, and Zuckerberg's Q1 operating memo frames automation as a margin-expansion lever rather than a support tool for growing headcount.", url: "https://investor.fb.com/mock10" },
    { direction: "down", text: "LinkedIn and Levels.fyi data both point to a weaker labor market for senior SWE mobility: fewer comparable openings, flatter compensation bands, and longer interview loops for lateral moves.", url: "https://levels.fyi/mock8" },
    { direction: "up", text: "Compensation remains top-decile and brand equity is still strong, but that is a retention trap in this setup: good cash flow today, deteriorating career capital tomorrow." },
  ],
  summary: "Exit before the brand premium stops compensating for the role decay.",
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
    const reasoning = "Revenue is strong at $36.4B and the company is not in financial distress, but that is the wrong lens for this role. The career asset here is not Meta equity; it is the future value of being a software engineer inside this org. The data points in one direction: fewer SWE openings, more aggressive performance filtering, and explicit automation pressure from leadership. Compensation is still excellent, but the risk is that it becomes a premium paid to keep people in place while the role's leverage declines. This is a profitable company with a shrinking opportunity surface for generalist software engineers, which makes the position look less like a long-term compounder and more like a short-term cash harvest.";
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
