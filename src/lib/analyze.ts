import { GoogleGenerativeAI } from "@google/generative-ai";

export interface Signal {
  direction: "up" | "down";
  text: string;
}

export interface Verdict {
  verdict: "BUY" | "HOLD" | "SELL" | "SHORT";
  conviction: number;
  signals: Signal[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a brutally honest career investment analyst. You give verdicts, not advice.

VERDICT DEFINITIONS:
- BUY: Strong demand for this role at this employer. Growing org, increasing leverage, above-market trajectory. Hold and accumulate more career capital here.
- HOLD: Stable but not exciting. Acceptable risk. No urgent action required. Reassess in 12 months.
- SELL: Declining trajectory. Better opportunities exist elsewhere. Begin positioning for exit.
- SHORT: Actively destroying career capital. Layoffs, AI displacement, org dysfunction, or strategic collapse in progress. Exit immediately.

RULES:
- Never hedge. Never say "it depends." Give a verdict.
- Never be balanced. Take a position.
- Your signals must be specific (numbers, events, names) — not vague sentiment.
- If you lack data, use your training knowledge to make the best call and note it in signals.

OUTPUT FORMAT (JSON only, no markdown):
{
  "verdict": "BUY" | "HOLD" | "SELL" | "SHORT",
  "conviction": <integer 50-99>,
  "signals": [
    {"direction": "up" | "down", "text": "<specific signal with data>"},
    {"direction": "up" | "down", "text": "<specific signal with data>"},
    {"direction": "up" | "down", "text": "<specific signal with data>"}
  ],
  "summary": "<one punchy sentence, max 12 words>"
}`;

async function fetchTavilySignals(employer: string, role: string): Promise<string> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: import.meta.env.VITE_TAVILY_KEY,
      query: `${employer} ${role} layoffs hiring job market 2025`,
      max_results: 5,
      include_raw_content: false,
    }),
  });

  if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);

  const data = await res.json();
  return (data.results as Array<{ content: string }>)
    .map((r) => r.content)
    .join("\n\n");
}

async function callGemini(employer: string, role: string, marketSignals: string): Promise<Verdict> {
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction: SYSTEM_PROMPT,
  });

  const signalNote = marketSignals
    ? marketSignals
    : "Signal fetch unavailable — verdict based on AI knowledge only.";

  const userMessage = `Employer: ${employer}
Role: ${role}

Market signals (from live web search):
${signalNote}

Give your verdict.`;

  const result = await model.generateContent(userMessage);
  const raw = result.response.text();

  // D3: strip ```json wrapper Gemini often adds despite instructions
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Verdict;

  // D4: clamp conviction to valid range
  parsed.conviction = Math.min(99, Math.max(50, parsed.conviction));

  return parsed;
}

const MOCK_VERDICT: Verdict = {
  verdict: "SHORT",
  conviction: 87,
  signals: [
    { direction: "down", text: "12,000 layoffs announced Q1 2025, largest since 2008 restructuring" },
    { direction: "down", text: "AI replacing 40% of junior engineering roles per internal memo leak" },
    { direction: "up", text: "Compensation still above market — golden handcuffs, not opportunity" },
  ],
  summary: "Exit now. The stock is falling and you're holding.",
};

export async function analyzePosition(employer: string, role: string): Promise<Verdict> {
  if (import.meta.env.VITE_MOCK === "true") {
    await new Promise((r) => setTimeout(r, 2000));
    return { ...MOCK_VERDICT };
  }
  const timeout = new Promise<never>((_, reject) =>
    // D5: 10s timeout so demo never hangs
    setTimeout(() => reject(new Error("Analysis timed out")), 10_000)
  );

  const work = async (): Promise<Verdict> => {
    let marketSignals = "";
    try {
      marketSignals = await fetchTavilySignals(employer, role);
      console.log("[analyze] Tavily signals fetched:", marketSignals.slice(0, 200));
    } catch (e) {
      console.warn("[analyze] Tavily failed (non-fatal):", e);
    }
    try {
      const verdict = await callGemini(employer, role, marketSignals);
      console.log("[analyze] Gemini verdict:", verdict);
      return verdict;
    } catch (e) {
      console.error("[analyze] Gemini failed:", e);
      throw e;
    }
  };

  return Promise.race([work(), timeout]);
}
