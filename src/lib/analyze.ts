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
- If a signal is grounded in a provided source, include that source's URL in the "url" field. Otherwise omit "url".
- Your final answer must be the career_verdict structured output.`;

const GOOGLE_ANALYSIS_PROMPT = `You are a brutally honest career investment analyst. You give verdicts, not advice.

VERDICT DEFINITIONS:
- BUY: Strong demand for this role at this employer. Growing org, increasing leverage, above-market trajectory. Hold and accumulate more career capital here.
- HOLD: Stable but not exciting. Acceptable risk. No urgent action required. Reassess in 12 months.
- SELL: Declining trajectory. Better opportunities exist elsewhere. Begin positioning for exit.
- SHORT: Actively destroying career capital. Layoffs, AI displacement, org dysfunction, or strategic collapse in progress. Exit immediately.

RULES:
- Write 2-3 sentences of raw analysis: what you're seeing in the data, the key signal, why you're leaning the direction you are. Be specific — company names, numbers, dates.
- Never hedge. Never say "it depends." Take a position.
- Never output JSON in this step.
- Never output the final verdict object in this step.`;

const GOOGLE_STRUCTURED_PROMPT = `You are a brutally honest career investment analyst. You give verdicts, not advice.

VERDICT DEFINITIONS:
- BUY: Strong demand for this role at this employer. Growing org, increasing leverage, above-market trajectory. Hold and accumulate more career capital here.
- HOLD: Stable but not exciting. Acceptable risk. No urgent action required. Reassess in 12 months.
- SELL: Declining trajectory. Better opportunities exist elsewhere. Begin positioning for exit.
- SHORT: Actively destroying career capital. Layoffs, AI displacement, org dysfunction, or strategic collapse in progress. Exit immediately.

RULES:
- Return only a JSON object matching the response schema.
- The conviction field is signal strength, not a probability. Use 50-64 for weak/mixed evidence, 65-79 for solid directional evidence, 80-89 for strong evidence with multiple concrete signals, and 90-99 only for overwhelming evidence from many recent authoritative sources.
- Always return 3-5 signals. Do not return an empty signals array.
- The summary field must be one punchy sentence, max 12 words.
- Never hedge. Never say "it depends." Give a verdict.
- Never be balanced. Take a position.
- Your signals must be specific: numbers, dates, executive names, product names. No vague sentiment.
- If a signal is grounded in a provided source, include that source's URL in the "url" field. Otherwise omit "url".`;

const VERDICT_SCHEMA = {
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
};

const GEMINI_VERDICT_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["BUY", "HOLD", "SELL", "SHORT"] },
    conviction: { type: "INTEGER" },
    signals: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          direction: { type: "STRING", enum: ["up", "down"] },
          text: { type: "STRING" },
          url: { type: "STRING" },
        },
        required: ["direction", "text"],
      },
    },
    summary: { type: "STRING" },
  },
  required: ["verdict", "conviction", "signals", "summary"],
};

const VERDICT_TOOL: Anthropic.Tool = {
  name: "career_verdict",
  description: "Output the career investment verdict as structured data.",
  input_schema: VERDICT_SCHEMA,
};

const TAVILY_KEY = () => import.meta.env.VITE_TAVILY_KEY as string;
const GOOGLE_KEY = () => import.meta.env.VITE_GOOGLE_KEY as string;
const GOOGLE_MODEL = () => (import.meta.env.VITE_GOOGLE_MODEL as string | undefined) || "gemini-2.5-flash";
const ANTHROPIC_MODEL = () => (import.meta.env.VITE_ANTHROPIC_MODEL as string | undefined) || "claude-haiku-4-5-20251001";

type AIProvider = "google" | "anthropic";

function getAIProvider(): AIProvider {
  const provider = ((import.meta.env.VITE_AI_PROVIDER as string | undefined) || "anthropic").trim().toLowerCase();
  if (provider === "google" || provider === "anthropic") return provider;
  throw new Error(`Unsupported VITE_AI_PROVIDER "${provider}". Use "google" or "anthropic".`);
}

// Domains considered authoritative for career/company research
const QUALITY_DOMAINS = [
  "techcrunch.com", "bloomberg.com", "wsj.com", "ft.com", "reuters.com",
  "cnbc.com", "forbes.com", "businessinsider.com", "theverge.com", "wired.com",
  "nytimes.com", "washingtonpost.com", "axios.com", "fortune.com",
  "linkedin.com", "glassdoor.com", "levels.fyi", "layoffs.fyi",
  "crunchbase.com", "pitchbook.com", "sec.gov", "ir.", "investor.",
  "careers.google.com", "jobs.apple.com", "amazon.jobs", "metacareers.com",
  "careers.microsoft.com", "openai.com", "anthropic.com", "cloud.google.com",
];

const COMPANY_NEWS_DOMAINS = [
  "reuters.com", "bloomberg.com", "wsj.com", "ft.com", "cnbc.com",
  "businessinsider.com", "theverge.com", "techcrunch.com", "fortune.com",
  "axios.com", "forbes.com", "sec.gov",
];

const ROLE_MARKET_DOMAINS = [
  "linkedin.com", "glassdoor.com", "levels.fyi", "layoffs.fyi",
  "careers.google.com", "jobs.apple.com", "amazon.jobs", "metacareers.com",
  "careers.microsoft.com", "wellfound.com",
];

function isQualitySource(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    return QUALITY_DOMAINS.some((d) => host.includes(d));
  } catch {
    return false;
  }
}

function isUsableSource(source: { title?: string; url?: string }): boolean {
  const title = (source.title ?? "").trim().toLowerCase();
  if (!source.url) return false;
  if (!title) return false;
  return ![
    "just a moment",
    "access denied",
    "attention required",
    "enable javascript",
    "sign in",
  ].some((blocked) => title.includes(blocked));
}

async function streamResearch(
  employer: string,
  role: string,
  onSource: (source: TavilySource) => void
): Promise<{ content: string; sources: TavilySource[] }> {
  type TavilyResult = { title?: string; url: string; content?: string; snippet?: string; score?: number };

  const search = async (
    query: string,
    options: { include_domains?: string[]; max_results?: number } = {}
  ): Promise<{ answer: string; results: TavilyResult[] }> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6_000);
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TAVILY_KEY()}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          query,
          search_depth: "basic",
          topic: "general",
          max_results: options.max_results ?? 8,
          include_answer: true,
          include_raw_content: false,
          include_domains: options.include_domains,
        }),
      });
      if (!res.ok) throw new Error(`Research failed: ${res.status}`);
      const data = await res.json();
      return {
        answer: typeof data.answer === "string" ? data.answer : "",
        results: (data.results ?? data.sources ?? []) as TavilyResult[],
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const queries = [
    search(`${employer} company hiring layoffs reorganization earnings AI strategy`, {
      include_domains: COMPANY_NEWS_DOMAINS,
      max_results: 8,
    }),
    search(`${employer} careers ${role} jobs hiring openings compensation`, {
      include_domains: ROLE_MARKET_DOMAINS,
      max_results: 8,
    }),
    search(`"${employer}" "${role}" hiring layoffs career outlook`, {
      max_results: 8,
    }),
  ];

  const responses = await Promise.allSettled(queries);
  const answer = responses
    .filter((response): response is PromiseFulfilledResult<{ answer: string; results: TavilyResult[] }> => response.status === "fulfilled")
    .map((response) => response.value.answer)
    .find(Boolean) ?? "";
  const rawSources = responses.flatMap((response) =>
    response.status === "fulfilled" ? response.value.results : []
  );

  if (rawSources.length === 0) {
    return { content: "", sources: [] };
  }

  const employerTokens = employer.toLowerCase().split(/\s+/).filter((token) => token.length > 2);
  const roleTokens = role.toLowerCase().split(/\W+/).filter((token) => token.length > 2);

  const relevanceScore = (source: TavilyResult): number => {
    const haystack = `${source.title ?? ""} ${source.url} ${source.content ?? source.snippet ?? ""}`.toLowerCase();
    const employerHits = employerTokens.filter((token) => haystack.includes(token)).length;
    const roleHits = roleTokens.filter((token) => haystack.includes(token)).length;
    const qualityBoost = isQualitySource(source.url) ? 2 : 0;
    const tavilyScore = typeof source.score === "number" ? source.score : 0;
    return qualityBoost + employerHits * 2 + roleHits + tavilyScore;
  };

  const seenUrls = new Set<string>();
  const sources = rawSources
    .filter(isUsableSource)
    .sort((a, b) => relevanceScore(b) - relevanceScore(a))
    .filter((source) => {
      const normalized = source.url.replace(/\/$/, "");
      if (seenUrls.has(normalized)) return false;
      seenUrls.add(normalized);
      return relevanceScore(source) >= 2;
    })
    .slice(0, 8)
    .map((source) => ({
      title: source.title ?? source.url,
      url: source.url,
      content: source.content ?? source.snippet ?? "",
    }));

  for (const source of sources) {
    onSource(source);
    await new Promise((resolve) => window.setTimeout(resolve, 90));
  }

  const sourceNotes = sources
    .map((source, index) => `[${index + 1}] ${source.title}${source.content ? `: ${source.content}` : ""}`)
    .join("\n");
  const content = [answer, sourceNotes].filter(Boolean).join("\n\n");

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
    model: ANTHROPIC_MODEL(),
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
  parsed.summary = normalizeSummary(parsed.summary, parsed.verdict);
  parsed.conviction = Math.min(99, Math.max(50, parsed.conviction));
  parsed.signals = normalizeSignals(parsed, researchContent, sources);
  return parsed;
}

interface GeminiPart {
  text?: string;
  functionCall?: {
    name?: string;
    args?: Verdict;
  };
}

interface GeminiChunk {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

type JsonObject = Record<string, unknown>;

function buildVerdictPrompt(
  employer: string,
  role: string,
  researchContent: string,
  sources: TavilySource[]
): string {
  const sourceList = sources.length
    ? sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`).join("\n")
    : "No sources available.";

  return `Employer: ${employer}
Role: ${role}

RESEARCH (most recent signals first):
${researchContent}

SOURCES:
${sourceList}

Give your verdict.`;
}

function buildGoogleAnalysisPrompt(
  employer: string,
  role: string,
  researchContent: string,
  sources: TavilySource[]
): string {
  return `${buildVerdictPrompt(employer, role, researchContent, sources)}

Write only the raw analysis shown to the user while loading.`;
}

function buildGoogleStructuredPrompt(
  employer: string,
  role: string,
  researchContent: string,
  sources: TavilySource[]
): string {
  return `${buildVerdictPrompt(employer, role, researchContent, sources)}

Return the structured verdict object.`;
}

function consumeGeminiChunk(
  chunk: GeminiChunk,
  onToken: (text: string) => void
): Verdict | null {
  let verdict: Verdict | null = null;
  for (const candidate of chunk.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.text) onToken(part.text);
      if (part.functionCall?.name === "career_verdict" && part.functionCall.args) {
        verdict = part.functionCall.args;
      }
    }
  }
  return verdict;
}

function parseVerdictFromText(text: string): Verdict | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const candidates = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim(),
    trimmed.match(/\{[\s\S]*\}/)?.[0],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const parsed = coerceVerdict(JSON.parse(candidate));
      if (parsed) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceSignal(value: unknown): Signal | null {
  if (!isObject(value)) return null;

  const text = typeof value.text === "string" ? value.text.trim() : "";
  if (!text) return null;

  const direction = value.direction === "up" || value.direction === "down"
    ? value.direction
    : "down";
  const signal: Signal = { direction, text };
  if (typeof value.url === "string" && value.url.trim()) {
    signal.url = value.url.trim();
  }
  return signal;
}

function coerceVerdict(value: unknown, depth = 0): Verdict | null {
  if (depth > 5) return null;

  if (typeof value === "string") {
    return parseVerdictFromText(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const verdict = coerceVerdict(item, depth + 1);
      if (verdict) return verdict;
    }
    return null;
  }

  if (!isObject(value)) return null;

  const verdict = typeof value.verdict === "string" ? value.verdict.toUpperCase() : "";
  const conviction = typeof value.conviction === "number"
    ? value.conviction
    : typeof value.conviction === "string"
      ? Number.parseInt(value.conviction, 10)
      : Number.NaN;
  const signals = Array.isArray(value.signals)
    ? value.signals.map(coerceSignal).filter(Boolean) as Signal[]
    : [];
  const summary = typeof value.summary === "string" ? value.summary.trim() : "";

  if (
    ["BUY", "HOLD", "SELL", "SHORT"].includes(verdict) &&
    Number.isFinite(conviction)
  ) {
    return {
      verdict: verdict as Verdict["verdict"],
      conviction,
      signals,
      summary: summary || `${verdict} signal dominates.`,
    };
  }

  for (const key of ["career_verdict", "careerVerdict", "verdict_object", "verdictObject", "args", "functionCall", "content", "parts", "candidates"]) {
    const nested = coerceVerdict(value[key], depth + 1);
    if (nested) return nested;
  }

  for (const nested of Object.values(value)) {
    const found = coerceVerdict(nested, depth + 1);
    if (found) return found;
  }

  return null;
}

async function callGoogle(
  employer: string,
  role: string,
  researchContent: string,
  sources: TavilySource[],
  onToken: (text: string) => void
): Promise<Verdict> {
  const apiKey = GOOGLE_KEY();
  if (!apiKey) throw new Error("Missing VITE_GOOGLE_KEY");

  const model = GOOGLE_MODEL().replace(/^models\//, "");
  const streamRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: GOOGLE_ANALYSIS_PROMPT }],
      },
      contents: [{
        role: "user",
        parts: [{ text: buildGoogleAnalysisPrompt(employer, role, researchContent, sources) }],
      }],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.2,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    }),
  });

  if (!streamRes.ok) {
    const details = await streamRes.text().catch(() => "");
    throw new Error(`Google analysis failed: ${streamRes.status}${details ? ` ${details}` : ""}`);
  }

  let streamedAnalysis = "";
  const onGeminiToken = (text: string) => {
    streamedAnalysis += text;
    onToken(text);
  };

  if (streamRes.headers.get("content-type")?.includes("text/event-stream") && streamRes.body) {
    const reader = streamRes.body.getReader();
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

        try {
          consumeGeminiChunk(JSON.parse(raw) as GeminiChunk, onGeminiToken);
        } catch {
          continue;
        }
      }
    }
  } else {
    const data = await streamRes.json();
    const chunks = Array.isArray(data) ? data : [data];
    for (const chunk of chunks) {
      consumeGeminiChunk(chunk as GeminiChunk, onGeminiToken);
    }
  }

  const verdictRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: GOOGLE_STRUCTURED_PROMPT }],
      },
      contents: [{
        role: "user",
        parts: [{ text: buildGoogleStructuredPrompt(employer, role, researchContent, sources) }],
      }],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: GEMINI_VERDICT_SCHEMA,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    }),
  });

  if (!verdictRes.ok) {
    const details = await verdictRes.text().catch(() => "");
    throw new Error(`Google verdict failed: ${verdictRes.status}${details ? ` ${details}` : ""}`);
  }

  const verdictData = await verdictRes.json() as GeminiChunk;
  const verdictText = verdictData.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim() ?? "";
  const parsed = coerceVerdict(verdictData) ?? parseVerdictFromText(verdictText);

  if (!parsed) throw new Error("No parseable Google verdict in response");
  if (!streamedAnalysis.trim()) {
    onToken(buildFallbackAnalystNote(parsed, researchContent, sources));
  }
  parsed.summary = normalizeSummary(parsed.summary, parsed.verdict);
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

function normalizeSummary(summary: string, verdict: Verdict["verdict"]): string {
  const clean = summary?.replace(/\s+/g, " ").trim() || `${verdict} signal dominates.`;
  const words = clean.split(" ");
  if (words.length <= 12) return clean;
  return `${words.slice(0, 12).join(" ").replace(/[.,;:!?]+$/, "")}.`;
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

    const provider = getAIProvider();
    const analyze = provider === "google" ? callGoogle : callClaude;

    return analyze(employer, role, researchContent, sources, (text) => {
      onProgress({ type: "analysis_token", text });
    });
  };

  return Promise.race([work(), timeout]);
}
