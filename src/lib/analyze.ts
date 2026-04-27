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

export interface VerdictChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface VerdictChatContext {
  employer: string;
  role: string;
  verdict: Verdict;
  sources: TavilySource[];
  researchText: string;
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
- HOLD: Stable, mixed, or uncertain evidence. Acceptable risk, especially when role demand remains healthy or the employer is still investing in this function. No urgent action required. Reassess in 12 months.
- SELL: Clear role-specific decline. Better opportunities likely exist elsewhere, but there is no immediate career emergency. Begin positioning for exit.
- SHORT: Actively destroying career capital. Use only for strong, recent, role-specific evidence of layoffs, automation displacement, org dysfunction, or strategic collapse directly affecting this role. Exit immediately.

RULES:
- First, write the analyst note in this exact format and nothing else:
  - Line 1: a bold headline of max 14 words that captures the call. Wrap it in **double asterisks**.
  - Then exactly 3 bullet points starting with "- ". Each bullet is 18-32 words and MUST be a fact PLUS a so-what — i.e. the concrete signal (number, name, date) followed by what it means for THIS person in THIS role. Each bullet should read as one sentence with a clause break (comma or em-dash). Bullets must NOT just restate the structured signals; they must add interpretation, context, or implication.
  - Final line: a single italic closing in the form "*What would flip this:* <one short condition, max 14 words>".
  - No other prose, no headings, no closing summary.
- The structured career_verdict.signals should remain short fragments (6-12 words). The analyst note bullets are the longer interpretive layer.
- Then call career_verdict with your structured output.
- The conviction field is signal strength, not a probability. It should answer: "How strongly does the evidence support this exact verdict?" Use 50-64 for weak/mixed evidence, 65-79 for solid directional evidence, 80-89 for strong evidence with multiple concrete signals, and 90-99 only for overwhelming evidence from many recent authoritative sources.
- Always return 3-5 signals in career_verdict.signals. Do not return an empty signals array.
- Each signal text MUST be a single short fragment of 6-12 words. No second clause, no semicolons, no "while" / "but" subclauses. Lead with the concrete fact (number, name, date).
- Never hedge. Never say "it depends." Give a verdict.
- Take a position. HOLD is a real verdict, not a parking lot for indecision.
- HOLD QUOTA: in the long run roughly one in four verdicts should be HOLD. Use it ONLY when up-signals and down-signals are genuinely close to 50/50 in count AND comparable in weight AND no signal is decisive. If the picture leans 60/40 or stronger in either direction, you MUST commit to BUY/SELL (or BUY/SHORT, SELL/SHORT) instead.
- BUY when role-specific positives lean (≥60% of weighted signals are up) AND at least one positive is concrete + recent (active hiring, strategic investment in this function, comp/title leverage, scope expansion).
- SELL when role-specific negatives lean (≥60% of weighted signals are down) AND no immediate emergency.
- SHORT when acute role-specific downside is present: layoffs targeting this exact function, automation eliminating the role, strategic collapse of the function, or recent role-specific firings at scale. Two or more clearly negative role-specific signals + no offsetting strong positive = at least SELL, often SHORT.
- Anti-fence-sit rules: if you are about to write HOLD, first re-check both columns. If positives clearly outnumber negatives (3+ vs 0–1) → flip to BUY. If negatives clearly outnumber positives (3+ vs 0–1) → flip to SELL or SHORT. Only stay on HOLD if you can name the offsetting force on each side.
- Do not over-penalize generic tech layoffs, broad macro anxiety, or company-wide reorg noise that does not directly affect this role.
- A profitable company with isolated layoffs in OTHER functions is not a negative signal for this role. But layoffs in this exact function ARE a strong negative signal.
- Your signals must be specific: numbers, dates, executive names, product names. No vague sentiment.
- Weigh company health, recent news, hiring activity, and momentum signals. Weight recent signals (≤6 months) at roughly 2× older signals.
- If a signal is grounded in a provided source, include that source's URL in the "url" field. Otherwise omit "url".
- Your final answer must be the career_verdict structured output.`;

const GOOGLE_STRUCTURED_PROMPT = `You are a brutally honest career investment analyst. You give verdicts, not advice.

VERDICT DEFINITIONS:
- BUY: Strong demand for this role at this employer. Growing org, increasing leverage, above-market trajectory. Hold and accumulate more career capital here.
- HOLD: Stable, mixed, or uncertain evidence. Acceptable risk, especially when role demand remains healthy or the employer is still investing in this function. No urgent action required. Reassess in 12 months.
- SELL: Clear role-specific decline. Better opportunities likely exist elsewhere, but there is no immediate career emergency. Begin positioning for exit.
- SHORT: Actively destroying career capital. Use only for strong, recent, role-specific evidence of layoffs, automation displacement, org dysfunction, or strategic collapse directly affecting this role. Exit immediately.

RULES:
- Return only a JSON object matching the response schema.
- The conviction field is signal strength, not a probability. Use 50-64 for weak/mixed evidence, 65-79 for solid directional evidence, 80-89 for strong evidence with multiple concrete signals, and 90-99 only for overwhelming evidence from many recent authoritative sources.
- Always return 3-5 signals. Do not return an empty signals array.
- Each signal text MUST be a single short fragment of 6-12 words. No second clause, no semicolons, no "while" / "but" subclauses. Lead with the concrete fact (number, name, date).
- The summary field must be one punchy sentence, max 8 words.
- Never hedge. Never say "it depends." Give a verdict.
- Take a position. HOLD is a real verdict, not a parking lot for indecision.
- HOLD QUOTA: in the long run roughly one in four verdicts should be HOLD. Use it ONLY when up-signals and down-signals are genuinely close to 50/50 in count AND comparable in weight AND no signal is decisive. If the picture leans 60/40 or stronger in either direction, you MUST commit to BUY/SELL (or SHORT) instead.
- BUY when role-specific positives lean (≥60% of weighted signals are up) AND at least one positive is concrete + recent (active hiring, strategic investment in this function, comp/title leverage, scope expansion).
- SELL when role-specific negatives lean (≥60% of weighted signals are down) AND no immediate emergency.
- SHORT when acute role-specific downside is present: layoffs targeting this exact function, automation eliminating the role, strategic collapse of the function, or recent role-specific firings at scale. Two or more clearly negative role-specific signals + no offsetting strong positive = at least SELL, often SHORT.
- Anti-fence-sit rules: if you are about to write HOLD, first re-check both columns. If positives clearly outnumber negatives (3+ vs 0–1) → flip to BUY. If negatives clearly outnumber positives (3+ vs 0–1) → flip to SELL or SHORT. Only stay on HOLD if you can name the offsetting force on each side.
- Do not over-penalize generic tech layoffs, broad macro anxiety, or company-wide reorg noise that does not directly affect this role.
- A profitable company with isolated layoffs in OTHER functions is not a negative signal for this role. But layoffs in this exact function ARE a strong negative signal.
- Your signals must be specific: numbers, dates, executive names, product names. No vague sentiment.
- Weight recent signals (≤6 months) at roughly 2× older signals.
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
          text: { type: "string", description: "One short fragment, 6-12 words, single clause. Lead with the concrete fact (number, name, date)." },
          url: { type: "string", description: "Source URL if grounded in research" },
        },
        required: ["direction", "text"],
      },
      minItems: 3,
      maxItems: 5,
    },
    summary: { type: "string", description: "One punchy sentence, max 8 words" },
  },
  required: ["verdict", "conviction", "signals", "summary"],
};

const GEMINI_VERDICT_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: {
      type: "STRING",
      enum: ["BUY", "HOLD", "SELL", "SHORT"],
      description: "The career investment verdict.",
    },
    conviction: {
      type: "INTEGER",
      description: "Signal strength from 50 to 99, based only on the provided evidence.",
    },
    signals: {
      type: "ARRAY",
      description: "Three to five source-grounded signals that support the verdict.",
      items: {
        type: "OBJECT",
        properties: {
          direction: {
            type: "STRING",
            enum: ["up", "down"],
            description: "Whether this signal improves or damages the career investment case.",
          },
          text: {
            type: "STRING",
            description: "One short fragment, 6-12 words, single clause. Lead with the concrete fact (number, name, date). No semicolons, no 'while' or 'but' subclauses.",
          },
          url: {
            type: "STRING",
            description: "The exact source URL from the SOURCES section that supports this signal.",
          },
        },
        required: ["direction", "text", "url"],
      },
    },
    summary: {
      type: "STRING",
      description: "One punchy sentence, max 8 words.",
    },
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
const ANTHROPIC_KEY = () => import.meta.env.VITE_ANTHROPIC_KEY as string;
const JOB_API_URL = () => (import.meta.env.VITE_JOB_API_URL as string | undefined)?.trim() ?? "";
const SUPABASE_URL = () => (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const SUPABASE_ANON_KEY = () =>
  ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    "").trim();
const GOOGLE_MODEL = () => (import.meta.env.VITE_GOOGLE_MODEL as string | undefined) || "gemini-2.5-flash";
const ANTHROPIC_MODEL = () => (import.meta.env.VITE_ANTHROPIC_MODEL as string | undefined) || "claude-haiku-4-5-20251001";

type AIProvider = "google" | "anthropic";

function getAIProvider(): AIProvider {
  const provider = ((import.meta.env.VITE_AI_PROVIDER as string | undefined) || "anthropic").trim().toLowerCase();
  if (provider === "google" || provider === "anthropic") return provider;
  throw new Error(`Unsupported VITE_AI_PROVIDER "${provider}". Use "google" or "anthropic".`);
}

function hasProviderKey(provider = getAIProvider()): boolean {
  return provider === "google" ? Boolean(GOOGLE_KEY()) : Boolean(ANTHROPIC_KEY());
}

function hasEdgeFunction(): boolean {
  // Supabase client is always configured via Lovable Cloud, so the job-ai edge function is available.
  return true;
}

function shouldUseMockMode(): boolean {
  if (import.meta.env.VITE_MOCK === "true") return true;
  if (import.meta.env.VITE_MOCK === "false") return false;
  if (hasEdgeFunction()) return false;
  if (getJobApiUrl()) return false;
  return !TAVILY_KEY() || !hasProviderKey();
}

function getJobApiUrl(): string {
  const explicit = JOB_API_URL();
  if (explicit) return explicit.replace(/\/$/, "");

  const supabaseUrl = SUPABASE_URL();
  if (supabaseUrl) return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/job-ai`;

  return "";
}

async function callJobApi<T>(payload: Record<string, unknown>): Promise<T> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke("job-ai", { body: payload });
  if (error) {
    throw new Error(`Job API failed: ${error.message ?? "unknown error"}`);
  }
  return data as T;
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

const COMPANY_SIGNAL_DOMAINS = [
  "reuters.com", "bloomberg.com", "wsj.com", "ft.com", "cnbc.com",
  "businessinsider.com", "theverge.com", "techcrunch.com", "fortune.com",
  "axios.com", "forbes.com", "sec.gov", "investor.", "ir.",
];

const COMPENSATION_MARKET_DOMAINS = [
  "levels.fyi", "glassdoor.com", "linkedin.com", "teamblind.com",
  "layoffs.fyi", "indeed.com",
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

function bucketLabel(bucket?: string): string {
  switch (bucket) {
    case "company": return "Company baseline";
    case "employer": return "Employer news";
    case "role": return "Employer-role demand";
    case "role_market": return "Role market";
    case "risk": return "Downside risk";
    case "market": return "Compensation and mobility";
    case "upside": return "Strategic upside";
    case "broad": return "Broad fallback";
    default: return "Source";
  }
}

function bucketUse(bucket?: string): string {
  switch (bucket) {
    case "company": return "company health, trajectory, and operating momentum";
    case "employer": return "recent employer-specific news and organizational context";
    case "role": return "current demand for this exact role at this employer";
    case "role_market": return "broader market demand for this role outside the employer";
    case "risk": return "layoffs, automation pressure, reorgs, and downside risk";
    case "market": return "compensation, mobility, and outside-option strength";
    case "upside": return "strategic investment that could increase role value";
    case "broad": return "fallback context if stronger evidence is thin";
    default: return "general context";
  }
}

function cleanSnippet(text: string | undefined): string {
  return (text ?? "")
    .replace(/\s+/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .trim()
    .slice(0, 420);
}

function getSourceLimit(resultCount: number): number {
  if (resultCount >= 32) return 16;
  if (resultCount >= 24) return 14;
  if (resultCount >= 16) return 12;
  if (resultCount >= 10) return 10;
  return Math.max(4, resultCount);
}

async function streamResearch(
  employer: string,
  role: string,
  onSource: (source: TavilySource) => void
): Promise<{ content: string; sources: TavilySource[] }> {
  type SearchBucket = "company" | "employer" | "role" | "role_market" | "risk" | "market" | "upside" | "broad";
  type TavilyResult = { title?: string; url: string; content?: string; snippet?: string; score?: number; bucket?: SearchBucket };

  const search = async (
    bucket: SearchBucket,
    query: string,
    options: { max_results?: number } = {}
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
        }),
      });
      if (!res.ok) throw new Error(`Research failed: ${res.status}`);
      const data = await res.json();
      return {
        answer: typeof data.answer === "string" ? data.answer : "",
        results: ((data.results ?? data.sources ?? []) as TavilyResult[]).map((result) => ({ ...result, bucket })),
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const queries = [
    // Company-only: broad signal surface.
    search("company", employer, {
      max_results: 7,
    }),
    // Employer news: simple modifier for recent company trajectory.
    search("employer", `${employer} news`, {
      max_results: 6,
    }),
    // Employer + role: direct match.
    search("role", `${employer} ${role}`, {
      max_results: 7,
    }),
    // Role-only: broad market demand.
    search("role_market", role, {
      max_results: 6,
    }),
    // Downside risk: concise and searchable.
    search("risk", `${employer} layoffs`, {
      max_results: 7,
    }),
    // Compensation/mobility: concise role-company salary surface.
    search("market", `${employer} ${role} salary`, {
      max_results: 6,
    }),
    // Strategic upside: short product/strategy modifier.
    search("upside", `${employer} AI`, {
      max_results: 6,
    }),
    // Broad fallback catches useful pages outside curated domains.
    search("broad", `${employer} ${role} jobs`, {
      max_results: 6,
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

  const seenUrls = new Set<string>();
  const ranked = rawSources
    .filter(isUsableSource)
    .filter((source) => {
      const normalized = source.url.replace(/\/$/, "");
      if (seenUrls.has(normalized)) return false;
      seenUrls.add(normalized);
      return true;
    });

  const selected: TavilyResult[] = [];
  const bucketOrder: SearchBucket[] = ["company", "employer", "role", "role_market", "risk", "market", "upside", "broad"];
  for (const bucket of bucketOrder) {
    const source = ranked.find((candidate) =>
      candidate.bucket === bucket && !selected.some((selectedSource) => selectedSource.url === candidate.url)
    );
    if (source) selected.push(source);
  }
  for (const source of ranked) {
    if (selected.length >= getSourceLimit(ranked.length)) break;
    if (!selected.some((selectedSource) => selectedSource.url === source.url)) {
      selected.push(source);
    }
  }

  const sourceLimit = getSourceLimit(ranked.length);
  const sources = selected.slice(0, sourceLimit).map((source) => ({
      title: source.title ?? source.url,
      url: source.url,
      content: cleanSnippet(source.content ?? source.snippet),
  }));

  for (const source of sources) {
    onSource(source);
    await new Promise((resolve) => window.setTimeout(resolve, 90));
  }

  const evidenceBrief = selected.slice(0, sourceLimit)
    .map((source, index) => {
      const snippet = cleanSnippet(source.content ?? source.snippet);
      return [
        `SOURCE ${index + 1}`,
        `Bucket: ${bucketLabel(source.bucket)}`,
        `Title: ${source.title ?? source.url}`,
        `URL: ${source.url}`,
        snippet ? `Snippet: ${snippet}` : "",
        `Use for: ${bucketUse(source.bucket)}`,
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");

  const content = [
    `Research brief for ${employer} / ${role}`,
    "Interpretation guidance: weigh employer health, role-specific demand, downside risk, compensation/mobility, and strategic upside. Prefer role-specific evidence over generic macro commentary.",
    answer ? `Tavily answer: ${answer}` : "",
    evidenceBrief,
  ].filter(Boolean).join("\n\n");

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
    apiKey: ANTHROPIC_KEY(),
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
    ? sources.map((s, i) => {
        const snippet = s.content?.replace(/\s+/g, " ").trim();
        return [
          `[${i + 1}] ${s.title}`,
          `URL: ${s.url}`,
          snippet ? `Evidence: ${snippet}` : "",
        ].filter(Boolean).join("\n");
      }).join("\n\n")
    : "No sources available.";

  return `Employer: ${employer}
Role: ${role}

RESEARCH (most recent signals first):
${researchContent}

SOURCES:
${sourceList}

Give your verdict. Use SOURCES as the evidence base. Every structured signal must cite one exact source URL from SOURCES. Do not cite URLs that are not listed.`;
}

function buildGoogleAnalysisPrompt(
  employer: string,
  role: string,
  researchContent: string,
  sources: TavilySource[]
): string {
  return buildVerdictPrompt(employer, role, researchContent, sources);
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
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [{
        role: "user",
        parts: [{ text: buildGoogleAnalysisPrompt(employer, role, researchContent, sources) }],
      }],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.2,
        thinkingConfig: {
          thinkingBudget: 1024,
        },
      },
      tools: [{
        functionDeclarations: [{
          name: "career_verdict",
          description: "Output a source-grounded career investment verdict. Every signal must be supported by one exact source URL from the prompt.",
          parameters: GEMINI_VERDICT_SCHEMA,
        }],
      }],
    }),
  });

  if (!streamRes.ok) {
    const details = await streamRes.text().catch(() => "");
    throw new Error(`Google analysis failed: ${streamRes.status}${details ? ` ${details}` : ""}`);
  }

  let streamedAnalysis = "";
  let parsed: Verdict | null = null;
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
          parsed = consumeGeminiChunk(JSON.parse(raw) as GeminiChunk, onGeminiToken) ?? parsed;
        } catch {
          continue;
        }
      }
    }
  } else {
    const data = await streamRes.json();
    const chunks = Array.isArray(data) ? data : [data];
    for (const chunk of chunks) {
      parsed = consumeGeminiChunk(chunk as GeminiChunk, onGeminiToken) ?? parsed;
    }
  }

  if (!parsed) {
    parsed = parseVerdictFromText(streamedAnalysis);
  }

  if (!parsed) {
    parsed = await callGoogleStructuredVerdict(model, apiKey, employer, role, researchContent, sources);
  }

  if (!parsed) throw new Error("No parseable Google verdict in response");
  if (!streamedAnalysis.trim()) {
    onToken(buildFallbackAnalystNote(parsed, researchContent, sources));
  }
  parsed.summary = normalizeSummary(parsed.summary, parsed.verdict);
  parsed.conviction = Math.min(99, Math.max(50, parsed.conviction));
  parsed.signals = normalizeSignals(parsed, researchContent, sources);
  return parsed;
}

async function callGoogleStructuredVerdict(
  model: string,
  apiKey: string,
  employer: string,
  role: string,
  researchContent: string,
  sources: TavilySource[]
): Promise<Verdict | null> {
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
          thinkingBudget: 1024,
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

  return parsed;
}

function buildFallbackAnalystNote(
  verdict: Verdict,
  researchContent: string,
  sources: TavilySource[]
): string {
  const headline = `**${verdict.verdict} call: evidence is directional but not yet conclusive.**`;

  const upCount = (verdict.signals ?? []).filter((s) => s.direction === "up").length;
  const downCount = (verdict.signals ?? []).filter((s) => s.direction === "down").length;
  const balanceLine = `- Signal balance is ${upCount} positive vs ${downCount} negative, which keeps the call directional rather than high-conviction and means a single new data point could move the verdict.`;

  const sentences = researchContent
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 60 && sentence.length < 240)
    .slice(0, 2)
    .map((sentence) => `- ${sentence}`);

  const sourceFallback = sources
    .slice(0, 2 - sentences.length)
    .map((source) => `- ${source.title} suggests this thread is worth tracking, but the snippet alone is not enough to anchor a stronger reading.`);

  const bullets = [balanceLine, ...sentences, ...sourceFallback].slice(0, 3);
  while (bullets.length < 3) {
    bullets.push("- Evidence set is thin, so the verdict reflects limited directional signals rather than a high-conviction read.");
  }

  const flipLine = verdict.verdict === "BUY" || verdict.verdict === "HOLD"
    ? "*What would flip this:* a wave of role-specific layoffs or a clear automation mandate."
    : "*What would flip this:* a credible reinvestment in this function or fresh role-specific hiring.";

  return [headline, ...bullets, flipLine].join("\n");
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
  if (words.length <= 8) return clean;
  return `${words.slice(0, 8).join(" ").replace(/[.,;:!?]+$/, "")}.`;
}

function buildAdvisorSystemPrompt(context: VerdictChatContext): string {
  const signals = context.verdict.signals
    .map((signal, index) => `${index + 1}. ${signal.direction.toUpperCase()}: ${signal.text}${signal.url ? ` (${signal.url})` : ""}`)
    .join("\n");
  const sources = context.sources
    .map((source, index) => `[${index + 1}] ${source.title}\nURL: ${source.url}${source.content ? `\nSnippet: ${source.content}` : ""}`)
    .join("\n\n");
  const notes = context.researchText.replace(/\s+/g, " ").trim().slice(0, 3000);

  return `You are a pragmatic career advisor for someone currently holding this job.

JOB:
Employer: ${context.employer}
Role: ${context.role}

VERDICT:
${context.verdict.verdict}
Summary: ${context.verdict.summary}

SIGNALS:
${signals || "No structured signals available."}

SOURCES:
${sources || "No sources available."}

ANALYST NOTES:
${notes || "No analyst notes available."}

RULES:
- Answer like a Bloomberg terminal headline crossed with a no-bullshit mentor. Punchy. Sharp. Final.
- HARD CAP: exactly ONE sentence. Never two. Never a period followed by more text.
- Target length: 8-18 words. Never longer than 22 words.
- Lead with a verb or the verdict. No throat-clearing, no "based on", no "it depends", no "I think", no "you might want to", no "consider", no "perhaps".
- Banned phrases: "it depends", "in general", "ultimately", "at the end of the day", "make sure to", "keep in mind", "I'd recommend".
- Be concrete: name the number, the company, the lever, the date.
- Cut every adjective and adverb that doesn't carry information.
- If the user asks for a plan, fit it into one sentence using " · " separators (no bullets, no line breaks).
- No markdown. No bold. No headings. No lists. Plain prose only.
- Do not invent facts outside the provided context.

TONE EXAMPLES (style only — do not reuse content):
- "Ask for a 12% bump tied to AI infra scope; walk if they offer less than 8%."
- "Stay six months, ship one AI launch, then test the market with leverage."
- "Biggest risk is design org consolidating under product — get a PM-adjacent project now."
- "Verdict flips to SELL if Q3 hiring freeze hits your function."`;
}

async function chatWithClaude(
  context: VerdictChatContext,
  messages: VerdictChatMessage[],
  onToken: (text: string) => void
): Promise<string> {
  const client = new Anthropic({
    apiKey: ANTHROPIC_KEY(),
    dangerouslyAllowBrowser: true,
  });

  const stream = client.messages.stream({
    model: ANTHROPIC_MODEL(),
    max_tokens: 70,
    system: buildAdvisorSystemPrompt(context),
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  });

  let reply = "";
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta" &&
      event.delta.text
    ) {
      reply += event.delta.text;
      onToken(event.delta.text);
    }
  }

  return reply.trim();
}

async function chatWithGoogle(
  context: VerdictChatContext,
  messages: VerdictChatMessage[],
  onToken: (text: string) => void
): Promise<string> {
  const apiKey = GOOGLE_KEY();
  if (!apiKey) throw new Error("Missing VITE_GOOGLE_KEY");

  const model = GOOGLE_MODEL().replace(/^models\//, "");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildAdvisorSystemPrompt(context) }],
      },
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        maxOutputTokens: 70,
        temperature: 0.35,
        thinkingConfig: {
          thinkingBudget: 512,
        },
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Google chat failed: ${response.status}${details ? ` ${details}` : ""}`);
  }

  let reply = "";
  if (response.headers.get("content-type")?.includes("text/event-stream") && response.body) {
    const reader = response.body.getReader();
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
          const chunk = JSON.parse(raw) as GeminiChunk;
          for (const candidate of chunk.candidates ?? []) {
            for (const part of candidate.content?.parts ?? []) {
              if (part.text) {
                reply += part.text;
                onToken(part.text);
              }
            }
          }
        } catch {
          continue;
        }
      }
    }
  } else {
    const data = await response.json() as GeminiChunk;
    const text = data.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("") ?? "";
    reply += text;
    if (text) onToken(text);
  }

  return reply.trim();
}

export async function chatWithVerdictAI(
  context: VerdictChatContext,
  messages: VerdictChatMessage[],
  onToken: (text: string) => void
): Promise<string> {
  if (shouldUseMockMode()) {
    const reply = buildMockAdvisorReply(context, messages[messages.length - 1]?.content ?? "");
    onToken(reply);
    return reply;
  }

  if (hasEdgeFunction()) {
    const { reply } = await callJobApi<{ reply: string }>({
      action: "chat",
      context,
      messages,
    });
    if (reply) onToken(reply);
    return reply || "I could not generate a useful reply from the current verdict context.";
  }

  const provider = getAIProvider();
  const reply = provider === "google"
    ? await chatWithGoogle(context, messages, onToken)
    : await chatWithClaude(context, messages, onToken);

  return reply || "I could not generate a useful reply from the current verdict context.";
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
  verdict: "HOLD",
  conviction: 72,
  signals: [
    { direction: "down", text: "3,600 mid-level SWE layoffs in Q1 2025.", url: "https://techcrunch.com/mock1" },
    { direction: "down", text: "SWE openings down 40% YoY across the org.", url: "https://bloomberg.com/mock3" },
    { direction: "down", text: "Internal AI coding tools framed as headcount lever.", url: "https://investor.fb.com/mock10" },
    { direction: "down", text: "Performance review window stretched to 18 months." },
    { direction: "up", text: "Top-decile comp and strong brand preserve option value." },
    { direction: "up", text: "Revenue strong at $36.4B, up 16% YoY.", url: "https://wsj.com/mock2" },
    { direction: "up", text: "Internal mobility into AI infra still open." },
  ],
  summary: "Stay alert, but the seat still has option value.",
};

function buildMockAdvisorReply(context: VerdictChatContext, question: string): string {
  const normalized = question.toLowerCase();

  if (normalized.includes("flip") || normalized.includes("change")) {
    return `${context.verdict.verdict} flips if role-specific hiring, cuts, or automation signals move decisively.`;
  }

  if (normalized.includes("negotiat") || normalized.includes("salary") || normalized.includes("raise")) {
    return `Anchor on ${context.employer} brand value, but demand scope or comp for measurable leverage.`;
  }

  if (normalized.includes("risk")) {
    return `Biggest risk is role demand tightening faster than your internal mobility options.`;
  }

  if (normalized.includes("plan")) {
    return `Ship visible work now, test the market quietly, reassess after the next hiring signal.`;
  }

  return `${context.verdict.verdict}: preserve optionality, track role-specific demand, and avoid overreacting to broad noise.`;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function analyzePosition(
  employer: string,
  role: string,
  onProgress: (step: ProgressStep) => void
): Promise<Verdict> {
  if (import.meta.env.VITE_MOCK !== "true" && getJobApiUrl()) {
    onProgress({ type: "searching" });
    const result = await callJobApi<{
      verdict: Verdict;
      sources: TavilySource[];
      analysisText?: string;
    }>({
      action: "analyze",
      employer,
      role,
    });

    const sources = result.sources ?? [];
    for (const source of sources) {
      onProgress({ type: "source_found", source });
      await new Promise((resolve) => window.setTimeout(resolve, 90));
    }
    onProgress({ type: "search_complete", sourceCount: sources.length, sources });
    onProgress({ type: "analyzing" });

    const analysisText = result.analysisText?.trim() || buildFallbackAnalystNote(result.verdict, "", sources);
    for (const word of analysisText.split(" ")) {
      onProgress({ type: "analysis_token", text: `${word} ` });
      await new Promise((resolve) => window.setTimeout(resolve, 18));
    }

    return result.verdict;
  }

  if (shouldUseMockMode()) {
    onProgress({ type: "searching" });
    for (const src of MOCK_SOURCES) {
      await new Promise((r) => setTimeout(r, 350));
      onProgress({ type: "source_found", source: src });
    }
    onProgress({ type: "search_complete", sourceCount: MOCK_SOURCES.length, sources: MOCK_SOURCES });
    await new Promise((r) => setTimeout(r, 200));
    onProgress({ type: "analyzing" });
    const reasoning = "Revenue is strong at $36.4B and the company is not in financial distress, which matters because a profitable platform with top-decile compensation still gives this role meaningful option value. The negative signals are real: fewer SWE openings, more aggressive performance filtering, and explicit automation pressure from leadership. But the evidence points more to a tighter, higher-bar environment than an immediate career emergency. This is no longer an easy BUY, but the brand equity, compensation floor, and internal mobility options keep it in HOLD unless the role-specific cuts get sharper.";
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
