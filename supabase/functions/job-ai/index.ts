import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type Signal = {
  direction: "up" | "down";
  text: string;
  url?: string;
};

type Verdict = {
  verdict: "BUY" | "HOLD" | "SELL" | "SHORT";
  conviction: number;
  signals: Signal[];
  summary: string;
};

type TavilySource = {
  title: string;
  url: string;
  content: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatContext = {
  employer: string;
  role: string;
  verdict: Verdict;
  sources: TavilySource[];
  researchText: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const verdictSchema = {
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

const systemPrompt = `You are a brutally honest career investment analyst. You give verdicts, not advice.

Return only JSON matching the schema.
Verdicts:
- BUY: strong demand and growing leverage for this role at this employer.
- HOLD: stable, mixed, or uncertain evidence.
- SELL: clear role-specific decline, but no immediate emergency.
- SHORT: acute role-specific downside such as layoffs, automation displacement, dysfunction, or strategic collapse.

Rules:
- Always return 3-5 signals.
- Each signal text is 6-12 words, one clause, concrete, no vague sentiment.
- Use source URLs only from the SOURCES section.
- Conviction is signal strength from 50-99.
- Summary is one punchy sentence, max 8 words.
- Take a position; do not hedge.`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function env(name: string): string {
  return Deno.env.get(name) ?? "";
}

function cleanSnippet(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, 420);
}

function isUsableSource(source: { title?: string; url?: string }): boolean {
  const title = (source.title ?? "").trim().toLowerCase();
  if (!source.url || !title) return false;
  return !["just a moment", "access denied", "attention required", "enable javascript", "sign in"]
    .some((blocked) => title.includes(blocked));
}

async function tavilySearch(
  bucket: string,
  query: string,
  maxResults: number,
): Promise<Array<{ title?: string; url: string; content?: string; snippet?: string; bucket: string }>> {
  const apiKey = env("TAVILY_KEY");
  if (!apiKey) throw new Error("Missing TAVILY_KEY secret");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      topic: "general",
      max_results: maxResults,
      include_answer: true,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Tavily failed: ${response.status}${details ? ` ${details}` : ""}`);
  }

  const data = await response.json();
  return ((data.results ?? data.sources ?? []) as Array<{ title?: string; url: string; content?: string; snippet?: string }>)
    .map((result) => ({ ...result, bucket }));
}

async function research(employer: string, role: string): Promise<{ researchText: string; sources: TavilySource[] }> {
  const queries = [
    tavilySearch("company", employer, 7),
    tavilySearch("employer", `${employer} news`, 6),
    tavilySearch("role", `${employer} ${role}`, 7),
    tavilySearch("role_market", role, 6),
    tavilySearch("risk", `${employer} layoffs`, 7),
    tavilySearch("market", `${employer} ${role} salary`, 6),
    tavilySearch("upside", `${employer} AI`, 6),
    tavilySearch("broad", `${employer} ${role} jobs`, 6),
  ];

  const settled = await Promise.allSettled(queries);
  const rawSources = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const seen = new Set<string>();
  const ranked = rawSources.filter(isUsableSource).filter((source) => {
    const normalized = source.url.replace(/\/$/, "");
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  const bucketOrder = ["company", "employer", "role", "role_market", "risk", "market", "upside", "broad"];
  const selected: typeof ranked = [];
  for (const bucket of bucketOrder) {
    const source = ranked.find((candidate) =>
      candidate.bucket === bucket && !selected.some((selectedSource) => selectedSource.url === candidate.url)
    );
    if (source) selected.push(source);
  }
  for (const source of ranked) {
    if (selected.length >= 14) break;
    if (!selected.some((selectedSource) => selectedSource.url === source.url)) selected.push(source);
  }

  const sources = selected.slice(0, 14).map((source) => ({
    title: source.title ?? source.url,
    url: source.url,
    content: cleanSnippet(source.content ?? source.snippet),
  }));

  const evidence = sources.map((source, index) => [
    `SOURCE ${index + 1}`,
    `Title: ${source.title}`,
    `URL: ${source.url}`,
    source.content ? `Snippet: ${source.content}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");

  return {
    sources,
    researchText: [
      `Research brief for ${employer} / ${role}`,
      "Weigh employer health, role-specific demand, downside risk, compensation/mobility, and strategic upside.",
      evidence,
    ].join("\n\n"),
  };
}

function parseVerdict(value: unknown): Verdict {
  if (typeof value === "string") {
    return parseVerdict(JSON.parse(value));
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Model returned invalid verdict");
  }

  const candidate = value as Record<string, unknown>;
  const verdict = String(candidate.verdict ?? "").toUpperCase();
  if (!["BUY", "HOLD", "SELL", "SHORT"].includes(verdict)) {
    throw new Error("Model returned unknown verdict");
  }

  const signals = Array.isArray(candidate.signals)
    ? candidate.signals.map((signal) => {
      const item = signal as Record<string, unknown>;
      return {
        direction: item.direction === "up" ? "up" : "down",
        text: String(item.text ?? "").trim(),
        url: typeof item.url === "string" ? item.url : undefined,
      };
    }).filter((signal) => signal.text)
    : [];

  return {
    verdict: verdict as Verdict["verdict"],
    conviction: Math.min(99, Math.max(50, Number(candidate.conviction) || 60)),
    signals: signals.slice(0, 5),
    summary: String(candidate.summary ?? `${verdict} signal dominates.`).replace(/\s+/g, " ").trim(),
  };
}

async function callGeminiJson(prompt: string): Promise<Verdict> {
  const apiKey = env("GOOGLE_KEY");
  if (!apiKey) throw new Error("Missing GOOGLE_KEY secret");

  const model = (env("GOOGLE_MODEL") || "gemini-2.5-flash").replace(/^models\//, "");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: verdictSchema,
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Google failed: ${response.status}${details ? ` ${details}` : ""}`);
  }

  const data = await response.json();
  const text = data.candidates
    ?.flatMap((candidate: { content?: { parts?: Array<{ text?: string }> } }) => candidate.content?.parts ?? [])
    .map((part: { text?: string }) => part.text ?? "")
    .join("")
    .trim();

  return parseVerdict(text || data);
}

function buildVerdictPrompt(employer: string, role: string, researchText: string, sources: TavilySource[]): string {
  const sourceList = sources.map((source, index) => [
    `[${index + 1}] ${source.title}`,
    `URL: ${source.url}`,
    source.content ? `Evidence: ${source.content}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");

  return `Employer: ${employer}
Role: ${role}

RESEARCH:
${researchText}

SOURCES:
${sourceList}

Return the structured verdict object.`;
}

function buildAnalysisText(verdict: Verdict, employer: string, role: string): string {
  const up = verdict.signals.filter((signal) => signal.direction === "up").length;
  const down = verdict.signals.filter((signal) => signal.direction === "down").length;
  return [
    `**${verdict.verdict}: ${verdict.summary}**`,
    `- ${employer} / ${role} shows ${up} positive and ${down} negative sourced signals, so the call reflects role-specific evidence rather than generic market noise.`,
    `- Conviction is ${verdict.conviction}, which means the evidence is directional but should still be retested against the next hiring or layoff signal.`,
    `- The strongest sources point to current employer momentum, role demand, and downside risk, which together drive the verdict more than brand alone.`,
    verdict.verdict === "BUY" || verdict.verdict === "HOLD"
      ? "*What would flip this:* role-specific layoffs or a hiring freeze."
      : "*What would flip this:* credible reinvestment in this function.",
  ].join("\n");
}

function buildChatPrompt(context: ChatContext, messages: ChatMessage[]): string {
  const signals = context.verdict.signals
    .map((signal, index) => `${index + 1}. ${signal.direction.toUpperCase()}: ${signal.text}${signal.url ? ` (${signal.url})` : ""}`)
    .join("\n");
  const sources = context.sources
    .map((source, index) => `[${index + 1}] ${source.title}\nURL: ${source.url}\nSnippet: ${source.content}`)
    .join("\n\n");
  const lastQuestion = messages[messages.length - 1]?.content ?? "";

  return `Answer exactly one sentence, 8-22 words, direct and concrete.

Employer: ${context.employer}
Role: ${context.role}
Verdict: ${context.verdict.verdict}
Summary: ${context.verdict.summary}

Signals:
${signals}

Sources:
${sources}

User question: ${lastQuestion}`;
}

async function callGeminiText(prompt: string): Promise<string> {
  const apiKey = env("GOOGLE_KEY");
  if (!apiKey) throw new Error("Missing GOOGLE_KEY secret");

  const model = (env("GOOGLE_MODEL") || "gemini-2.5-flash").replace(/^models\//, "");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 80,
        temperature: 0.35,
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Google chat failed: ${response.status}${details ? ` ${details}` : ""}`);
  }

  const data = await response.json();
  return data.candidates
    ?.flatMap((candidate: { content?: { parts?: Array<{ text?: string }> } }) => candidate.content?.parts ?? [])
    .map((part: { text?: string }) => part.text ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim() || "Track role-specific hiring and risk signals before making a move.";
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await request.json();

    if (body.action === "analyze") {
      const employer = String(body.employer ?? "").trim();
      const role = String(body.role ?? "").trim();
      if (!employer || !role) return jsonResponse({ error: "Missing employer or role" }, 400);

      const { researchText, sources } = await research(employer, role);
      const verdict = await callGeminiJson(buildVerdictPrompt(employer, role, researchText, sources));
      return jsonResponse({
        verdict,
        sources,
        analysisText: buildAnalysisText(verdict, employer, role),
      });
    }

    if (body.action === "chat") {
      const context = body.context as ChatContext;
      const messages = (body.messages ?? []) as ChatMessage[];
      if (!context?.verdict || !Array.isArray(messages)) return jsonResponse({ error: "Missing chat context" }, 400);

      const reply = await callGeminiText(buildChatPrompt(context, messages));
      return jsonResponse({ reply });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
