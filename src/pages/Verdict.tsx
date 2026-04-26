import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type RefObject } from "react";
import ReactMarkdown from "react-markdown";
import { chatWithVerdictAI, type Verdict as VerdictData, type TavilySource, type VerdictChatMessage } from "@/lib/analyze";
import { useTheme, type Colors } from "@/lib/theme";
import { Header } from "@/components/Header";
import { InfiniteGrid } from "@/components/ui/the-infinite-grid";
import { useScrollFade } from "@/hooks/use-overflow";

function buildTicker(employer: string, role: string): string {
  const emp = employer.trim().split(/\s+/)[0].toUpperCase();
  const roleAbbr = role.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 4);
  return `$${emp}-${roleAbbr}`;
}

function hostname(url: string): string {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}

function Divider({ colors }: { colors: Colors }) {
  return <div style={{ height: "1px", backgroundColor: colors.borderMuted, margin: "0" }} />;
}

function appendMessageAt(messages: VerdictChatMessage[], index: number, text: string): VerdictChatMessage[] {
  return messages.map((message, messageIndex) =>
    messageIndex === index ? { ...message, content: message.content + text } : message
  );
}

function updateMessageAt(messages: VerdictChatMessage[], index: number, text: string): VerdictChatMessage[] {
  return messages.map((message, messageIndex) =>
    messageIndex === index ? { ...message, content: text } : message
  );
}

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#!";

const CHAT_SUGGESTIONS = [
  "What would change this verdict?",
  "How should I negotiate from here?",
  "What's the biggest risk to my role?",
];

export default function Verdict() {
  const location = useLocation();
  const navigate = useNavigate();
  const { colors, theme } = useTheme();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<VerdictChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatFeedRef = useRef<HTMLDivElement>(null);
  const chatQueueRef = useRef("");
  const chatTypingRef = useRef(false);
  const assistantIndexRef = useRef<number | null>(null);

  const state = location.state as
    | { employer: string; role: string; verdict: VerdictData; sources: TavilySource[]; researchText: string; error?: never }
    | { employer: string; role: string; error: string; sources?: TavilySource[]; researchText?: string; verdict?: never }
    | null;

  // Animation state
  const prefersReduced = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ).current;

  const [displayVerdict, setDisplayVerdict] = useState<string>("");
  const [heroVisible, setHeroVisible] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [signalsVisible, setSignalsVisible] = useState(false);
  const [lowerVisible, setLowerVisible] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const positiveSignalsRef = useRef<HTMLDivElement>(null);
  const negativeSignalsRef = useRef<HTMLDivElement>(null);
  const notesPanelRef = useRef<HTMLDivElement>(null);
  const sourcesPanelRef = useRef<HTMLDivElement>(null);
  const positiveFade = useScrollFade(positiveSignalsRef, state?.verdict?.signals?.length ?? 0);
  const negativeFade = useScrollFade(negativeSignalsRef, state?.verdict?.signals?.length ?? 0);
  const notesFade = useScrollFade(notesPanelRef, `${notesOpen}-${state?.researchText?.length ?? 0}`);
  const sourcesFade = useScrollFade(sourcesPanelRef, `${sourcesOpen}-${state?.sources?.length ?? 0}`);

  useEffect(() => {
    const el = chatFeedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    if (!state) navigate("/");
  }, []);

  useEffect(() => {
    if (!state?.verdict) return;
    const target = state.verdict.verdict;

    if (prefersReduced) {
      setDisplayVerdict(target);
      setHeroVisible(true);
      setSummaryVisible(true);
      setSignalsVisible(true);
      setLowerVisible(true);
      setChatVisible(true);
      return;
    }

    // ── Verdict word scramble (0–700ms) ──────────────────────────────────────
    setDisplayVerdict(target.replace(/\S/g, () =>
      SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
    ));

    const INTERVAL = 38;
    const DURATION = 680;
    const totalFrames = Math.ceil(DURATION / INTERVAL);
    let frame = 0;

    const scrambleId = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      if (frame >= totalFrames) {
        clearInterval(scrambleId);
        setDisplayVerdict(target);
      } else {
        setDisplayVerdict(
          target.split("").map((char, i) => {
            // Each character resolves left-to-right with slight overlap
            const threshold = (i / target.length) * 0.55 + 0.45;
            if (progress >= threshold) return char;
            return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          }).join("")
        );
      }
    }, INTERVAL);

    // ── Ticker + badge (fade in immediately) ─────────────────────────────────
    const t1 = setTimeout(() => setHeroVisible(true), 80);

    // ── Summary text ─────────────────────────────────────────────────────────
    const t2 = setTimeout(() => setSummaryVisible(true), 550);

    // ── Signals stagger ───────────────────────────────────────────────────────
    const t4 = setTimeout(() => setSignalsVisible(true), 760);

    // ── Accordions + footer ───────────────────────────────────────────────────
    const t5 = setTimeout(() => setLowerVisible(true), 1150);

    // ── Advisor chat ──────────────────────────────────────────────────────────
    const t6 = setTimeout(() => setChatVisible(true), 1500);

    return () => {
      clearInterval(scrambleId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
    };
  }, []);

  if (!state) return null;

  if (!state.verdict) {
    return <ErrorScreen message={state.error || "Analysis failed. Please try again."} onReset={() => navigate("/")} colors={colors} />;
  }

  const { employer, role, verdict, sources = [], researchText = "" } = state;
  const ticker = buildTicker(employer, role);
  const verdictColor = colors.verdictColors[verdict.verdict];
  const signals = verdict.signals ?? [];

  const sendChatMessage = async (override?: string) => {
    const text = (override ?? chatInput).trim();
    if (!text || chatLoading) return;

    const nextMessages: VerdictChatMessage[] = [
      ...chatMessages,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ];
    const assistantIndex = nextMessages.length - 1;
    assistantIndexRef.current = assistantIndex;
    chatQueueRef.current = "";
    setChatInput("");
    setChatMessages(nextMessages);
    setChatLoading(true);
    setChatError("");

    try {
      const reply = await chatWithVerdictAI({
        employer,
        role,
        verdict,
        sources,
        researchText,
      }, nextMessages.slice(0, -1), (token) => {
        chatQueueRef.current += token;
        flushChatQueue();
      });
      if (!reply && !chatQueueRef.current) {
        setChatMessages((current) => updateMessageAt(current, assistantIndex, "I could not generate a useful reply from the current verdict context."));
      }
    } catch (err) {
      console.error("[Verdict] chat failed:", err);
      setChatError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      await waitForChatQueue();
      setChatLoading(false);
    }
  };

  const flushChatQueue = () => {
    if (chatTypingRef.current) return;
    chatTypingRef.current = true;

    const tick = () => {
      const index = assistantIndexRef.current;
      if (index === null) {
        chatTypingRef.current = false;
        return;
      }
      if (!chatQueueRef.current) {
        chatTypingRef.current = false;
        return;
      }

      const chunkSize = Math.min(chatQueueRef.current.length, 4);
      const nextText = chatQueueRef.current.slice(0, chunkSize);
      chatQueueRef.current = chatQueueRef.current.slice(chunkSize);
      setChatMessages((current) => appendMessageAt(current, index, nextText));
      window.setTimeout(tick, 10);
    };

    tick();
  };

  const waitForChatQueue = async () => {
    while (chatTypingRef.current || chatQueueRef.current.length > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 30));
    }
  };

  return (
    <div style={{
      height: "100vh",
      overflow: "hidden",
      backgroundColor: colors.bg,
      color: colors.text,
      fontFamily: "'Space Mono', 'Courier New', monospace",
      display: "flex",
      flexDirection: "column",
      position: "relative",
    }}>
      <InfiniteGrid
        aria-hidden="true"
        color={`${verdictColor}${theme === "dark" ? "5f" : "25"}`}
        backgroundColor={colors.bg}
        vignetteColor={theme === "dark" ? "rgba(10,10,10,0.96)" : "rgba(245,245,240,0.74)"}
        speed={0.18}
        gridSize={44}
        className="pointer-events-none fixed inset-0 z-0 h-screen"
      />
      <Header accentColor={verdictColor} />

      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        maxWidth: "1500px",
        margin: "0 auto",
        width: "100%",
        minHeight: 0,
        overflow: "hidden",
        padding: "0 32px 18px",
        position: "relative",
        zIndex: 1,
      }}>

        <div className="verdict-grid" style={{ minHeight: 0, flex: "1 1 auto", paddingTop: "20px" }}>
          <section className="panel hero-panel" style={{ opacity: heroVisible ? 1 : 0, transition: "opacity 0.4s ease-out" }}>
            <div className="hero-summary">
              <div style={{ display: "flex", flexDirection: "column", gap: "5px", minWidth: 0, marginBottom: "10px" }}>
                <span style={{ fontSize: "17px", color: colors.text, letterSpacing: "0.22em", fontWeight: 600 }}>{ticker}</span>
                <span style={{ fontSize: "11px", color: colors.textDim, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  {sources.length} sources
                </span>
              </div>
              <div style={{
                fontSize: "clamp(48px, 8vw, 82px)",
                fontWeight: 900,
                color: verdictColor,
                letterSpacing: "0",
                lineHeight: 1,
                marginBottom: "10px",
                textShadow: `0 0 60px ${verdictColor}1a`,
                fontVariantNumeric: "tabular-nums",
              }}>
                {displayVerdict || verdict.verdict}
              </div>
              <div style={{
                fontSize: "13px",
                color: colors.textSecondary,
                fontStyle: "italic",
                lineHeight: 1.6,
                paddingBottom: "2px",
                opacity: summaryVisible ? 1 : 0,
                transform: summaryVisible ? "translateY(0)" : "translateY(4px)",
                transition: "opacity 0.35s ease-out, transform 0.35s ease-out",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {verdict.summary}
              </div>
            </div>

            <div className="hero-signals">
              <SignalsColumn
                label="POSITIVE"
                accentColor={colors.verdictColors.BUY}
                arrow="↑"
                signals={signals.filter((signal) => signal.direction === "up")}
                listRef={positiveSignalsRef}
                fade={positiveFade}
                visible={signalsVisible}
                colors={colors}
              />
              <SignalsColumn
                label="NEGATIVE"
                accentColor={colors.verdictColors.SHORT}
                arrow="↓"
                signals={signals.filter((signal) => signal.direction === "down")}
                listRef={negativeSignalsRef}
                fade={negativeFade}
                visible={signalsVisible}
                colors={colors}
              />
            </div>
          </section>

          <section className="panel notes-panel" style={{ opacity: lowerVisible ? 1 : 0, transform: lowerVisible ? "translateY(0)" : "translateY(6px)", transition: "opacity 0.35s ease-out, transform 0.35s ease-out" }}>
            {researchText && (
              <>
                <button onClick={() => setNotesOpen((open) => !open)} className="panel-button" style={{ color: colors.textMuted }}>
                  <span>ANALYST NOTES</span>
                  <span style={{ transform: notesOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                </button>
                {notesOpen && (
                  <div ref={notesPanelRef} className="scrollbar-hidden notes-body" style={{
                    color: colors.textMuted,
                    overflowY: notesFade.overflowing ? "auto" : "visible",
                    WebkitMaskImage: notesFade.maskImage,
                    maskImage: notesFade.maskImage,
                    scrollbarWidth: "none",
                  }}>
                    <ReactMarkdown components={{
                      p: ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
                      strong: ({ children }) => <strong style={{ color: colors.textSecondary, fontWeight: 700 }}>{children}</strong>,
                      em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
                      ul: ({ children }) => <ul style={{ margin: "6px 0", paddingLeft: "0", listStyle: "none" }}>{children}</ul>,
                      li: ({ children }) => <li style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "4px" }}><span style={{ color: colors.accent, flexShrink: 0 }}>·</span><span>{children}</span></li>,
                      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: colors.textDim, textDecoration: "underline" }}>{children}</a>,
                    }}>
                      {researchText}
                    </ReactMarkdown>
                  </div>
                )}
              </>
            )}
            {sources.length > 0 && (
              <div style={{ flexShrink: 0 }}>
                <Divider colors={colors} />
                <button onClick={() => setSourcesOpen((open) => !open)} className="panel-button" style={{ color: colors.textMuted }}>
                  <span>SOURCES · {sources.length}</span>
                  <span style={{ transform: sourcesOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                </button>
                {sourcesOpen && (
                  <div ref={sourcesPanelRef} className="scrollbar-hidden sources-body" style={{
                    overflowY: sourcesFade.overflowing ? "auto" : "visible",
                    WebkitMaskImage: sourcesFade.maskImage,
                    maskImage: sourcesFade.maskImage,
                    scrollbarWidth: "none",
                  }}>
                    {sources.map((src, i) => (
                      <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" className="source-link">
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <span>{src.title}</span>
                        <span>{hostname(src.url)} ↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="chat-panel" style={{
            minHeight: 0,
            opacity: chatVisible ? 1 : 0,
            transform: chatVisible ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 0.35s ease-out, transform 0.35s ease-out",
          }}>
            <VerdictChatPanel
              input={chatInput}
              messages={chatMessages}
              loading={chatLoading}
              error={chatError}
              colors={colors}
              verdictColor={verdictColor}
              feedRef={chatFeedRef}
              suggestions={CHAT_SUGGESTIONS}
              onInputChange={setChatInput}
              onSend={() => sendChatMessage()}
              onPickSuggestion={(text) => sendChatMessage(text)}
            />
          </section>
        </div>

        <style>{`
          .verdict-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(380px, 1fr);
            grid-template-rows: minmax(260px, 0.7fr) minmax(0, 1.3fr);
            gap: 24px;
          }
          .panel,
          .chat-panel {
            min-height: 0;
            border: 1px solid ${colors.border};
            background: ${theme === "dark" ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.006)"};
            display: flex;
            flex-direction: column;
          }
          .panel {
            padding: 18px;
          }
          .hero-panel.panel {
            padding: 14px 18px;
          }
          .chat-panel {
            padding: 0;
          }
          .hero-panel {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: minmax(0, 0.55fr) 1px minmax(0, 1.45fr);
            column-gap: 8px;
            overflow: hidden;
          }
          .hero-panel::before {
            content: "";
            grid-column: 2;
            background: ${colors.borderMuted};
            margin: 4px 0;
          }
          .hero-summary {
            grid-column: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
          }
          .hero-signals {
            grid-column: 3;
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            column-gap: 14px;
            min-width: 0;
            min-height: 0;
            overflow: hidden;
            padding-bottom: 4px;
          }
          .signal-col {
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
            overflow: hidden;
          }
          .signal-col-label {
            font-size: 11px;
            letter-spacing: 0.22em;
            margin-bottom: 6px;
            flex-shrink: 0;
          }
          .signal-row {
            display: flex;
            gap: 6px;
            align-items: flex-start;
          }
          .notes-panel {
            overflow: hidden;
          }
          .panel-button {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            padding: 0 0 12px;
            background: transparent;
            border: none;
            cursor: pointer;
            font-family: inherit;
            font-size: 12px;
            letter-spacing: 0.2em;
            text-align: left;
            flex-shrink: 0;
          }
          .notes-body {
            flex: 1 1 auto;
            min-height: 0;
            font-size: 13px;
            line-height: 1.8;
            letter-spacing: 0.02em;
          }
          .sources-body {
            max-height: 180px;
            overflow-y: auto;
          }
          .source-link {
            display: grid;
            grid-template-columns: 24px minmax(0, 1fr) auto;
            align-items: center;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1px solid ${colors.borderMuted};
            color: ${colors.textMuted};
            text-decoration: none;
            font-size: 13px;
          }
          .source-link span:nth-child(1),
          .source-link span:nth-child(3) {
            color: ${colors.textDim};
            font-size: 11px;
          }
          .source-link span:nth-child(2) {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          @media (max-width: 860px) {
            .verdict-grid {
              grid-template-columns: minmax(0, 1fr);
              grid-template-rows: none;
              gap: 0;
              overflow-y: auto;
            }
            .panel,
            .chat-panel {
              min-height: 260px;
            }
            .hero-panel {
              grid-template-columns: minmax(0, 1fr);
              grid-template-rows: auto auto auto;
            }
            .hero-panel::before {
              grid-column: 1;
              grid-row: 2;
              height: 1px;
              width: 100%;
              margin: 6px 0;
            }
            .hero-summary { grid-column: 1; grid-row: 1; }
            .hero-signals { grid-column: 1; grid-row: 3; }
            .hero-signals {
              grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            }
          }
          @media (max-width: 540px) {
            .verdict-grid {
              font-size: 13px;
            }
          }
          .scrollbar-hidden::-webkit-scrollbar { display: none; }
          @keyframes blink { 0%,100%{opacity:0.2} 50%{opacity:1} }
        `}</style>

      </main>
    </div>
  );
}

type Signal = VerdictData["signals"][number];
type ScrollFadeState = {
  overflowing: boolean;
  showTopFade: boolean;
  showBottomFade: boolean;
  maskImage: string;
};

function SignalsColumn({
  label,
  accentColor,
  arrow,
  signals,
  listRef,
  fade,
  visible,
  colors,
}: {
  label: string;
  accentColor: string;
  arrow: string;
  signals: Signal[];
  listRef: RefObject<HTMLDivElement>;
  fade: ScrollFadeState;
  visible: boolean;
  colors: Colors;
}) {
  return (
    <div className="signal-col">
      <div className="signal-col-label" style={{ color: accentColor }}>
        {arrow} {label} · {signals.length}
      </div>
      <div
        ref={listRef}
        className="scrollbar-hidden"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          minHeight: 0,
          flex: "1 1 auto",
          overflowY: fade.overflowing ? "auto" : "visible",
          WebkitMaskImage: fade.maskImage,
          maskImage: fade.maskImage,
          paddingRight: fade.overflowing ? "4px" : 0,
          scrollbarWidth: "none",
        }}
      >
        {signals.length === 0 && (
          <div style={{ color: colors.textDim, fontSize: "12px", lineHeight: 1.5, fontStyle: "italic" }}>
            none
          </div>
        )}
        {signals.map((signal, i) => (
          <div
            key={i}
            className="signal-row"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(8px)",
              transition: `opacity 0.35s ease-out ${i * 90}ms, transform 0.35s ease-out ${i * 90}ms`,
            }}
          >
            <span style={{ fontSize: "11px", color: accentColor, flexShrink: 0, lineHeight: 1.5, width: "8px" }}>
              {arrow}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: "12px", color: colors.textSecondary, lineHeight: 1.5 }}>{signal.text}</span>
              {signal.url && (
                <a
                  href={signal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginLeft: "6px",
                    fontSize: "10px",
                    color: colors.textDim,
                    textDecoration: "none",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                  }}
                >
                  ↗ {hostname(signal.url)}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VerdictChatPanel({
  input,
  messages,
  loading,
  error,
  colors,
  verdictColor,
  feedRef,
  suggestions,
  onInputChange,
  onSend,
  onPickSuggestion,
}: {
  input: string;
  messages: VerdictChatMessage[];
  loading: boolean;
  error: string;
  colors: Colors;
  verdictColor: string;
  feedRef: RefObject<HTMLDivElement>;
  suggestions: string[];
  onInputChange: (value: string) => void;
  onSend: () => void;
  onPickSuggestion: (text: string) => void;
}) {
  const showSuggestions = messages.length === 0 && !loading;
  return (
    <div style={{
      flex: "1 1 auto",
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Space Mono', 'Courier New', monospace",
      color: colors.text,
    }}>
      <div style={{
        flex: "1 1 auto",
        minHeight: 0,
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 16px",
          borderBottom: `1px solid ${colors.borderMuted}`,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: "12px", color: verdictColor, letterSpacing: "0.22em" }}>ADVISOR CHAT</div>
            <div style={{ fontSize: "11px", color: colors.textDim, letterSpacing: "0.08em", marginTop: "3px" }}>
              verdict context loaded
            </div>
          </div>
          <div style={{
            width: "8px",
            height: "8px",
            backgroundColor: loading ? verdictColor : colors.textDim,
            opacity: loading ? 1 : 0.5,
          }} />
        </div>

        <div
          ref={feedRef}
          className="scrollbar-hidden"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            scrollbarWidth: "none",
          }}
        >
          {messages.length === 0 && (
            <div style={{
              color: colors.textMuted,
              fontSize: "13px",
              lineHeight: 1.65,
              letterSpacing: "0.03em",
            }}>
              Ask about negotiation, timing, risks, internal mobility, or what would change the verdict.
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "88%",
                border: `1px solid ${message.role === "user" ? `${verdictColor}55` : colors.borderMuted}`,
                backgroundColor: message.role === "user" ? `${verdictColor}12` : colors.bg,
                color: message.role === "user" ? colors.textSecondary : colors.textMuted,
                padding: "9px 11px",
                fontSize: "13px",
                lineHeight: 1.55,
                letterSpacing: "0.02em",
                fontStyle: message.role === "assistant" ? "italic" : "normal",
                fontWeight: 400,
              }}
            >
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
                  strong: ({ children }) => <span style={{ fontWeight: 400 }}>{children}</span>,
                  em: ({ children }) => <span style={{ fontStyle: "inherit" }}>{children}</span>,
                  ol: ({ children }) => <ol style={{ margin: "6px 0", paddingLeft: "18px" }}>{children}</ol>,
                  ul: ({ children }) => <ul style={{ margin: "6px 0", paddingLeft: "0", listStyle: "none" }}>{children}</ul>,
                  li: ({ children }) => (
                    <li style={{ marginBottom: "4px" }}>
                      {children}
                    </li>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: colors.textDim, textDecoration: "underline" }}>
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content || (message.role === "assistant" && loading ? " " : message.content)}
              </ReactMarkdown>
            </div>
          ))}
          {loading && (
            <div style={{
              alignSelf: "flex-start",
              color: colors.textDim,
              fontSize: "13px",
              letterSpacing: "0.14em",
              animation: "blink 1s ease-in-out infinite",
            }}>
              THINKING...
            </div>
          )}
          {error && (
            <div style={{
              color: verdictColor,
              fontSize: "12px",
              lineHeight: 1.5,
              letterSpacing: "0.04em",
            }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {showSuggestions && (
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          padding: "8px 12px",
          borderTop: `1px solid ${colors.borderMuted}`,
          flexShrink: 0,
        }}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onPickSuggestion(suggestion)}
              disabled={loading}
              style={{
                background: "transparent",
                border: `1px solid ${colors.borderMuted}`,
                color: colors.textMuted,
                fontFamily: "inherit",
                fontSize: "11px",
                letterSpacing: "0.04em",
                padding: "5px 10px",
                cursor: loading ? "default" : "pointer",
                whiteSpace: "nowrap",
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(event) => {
                if (loading) return;
                const el = event.currentTarget;
                el.style.borderColor = verdictColor;
                el.style.color = colors.textSecondary;
              }}
              onMouseLeave={(event) => {
                const el = event.currentTarget;
                el.style.borderColor = colors.borderMuted;
                el.style.color = colors.textMuted;
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          backgroundColor: "transparent",
          borderTop: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        <input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Ask the verdict AI..."
          disabled={loading}
          style={{
            minWidth: 0,
            height: "44px",
            background: "transparent",
            border: "none",
            outline: "none",
            color: colors.textSecondary,
            fontFamily: "inherit",
            fontSize: "13px",
            letterSpacing: "0.04em",
            padding: "0 14px",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            height: "44px",
            padding: "0 16px",
            background: "transparent",
            border: "none",
            borderLeft: `1px solid ${colors.borderMuted}`,
            color: loading ? colors.textDim : verdictColor,
            fontFamily: "inherit",
            fontSize: "12px",
            letterSpacing: "0.18em",
            cursor: loading ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          SEND
        </button>
      </form>
    </div>
  );
}

function ErrorScreen({ message, onReset, colors }: { message: string; onReset: () => void; colors: Colors }) {
  return (
    <div style={{
      height: "100vh",
      backgroundColor: colors.bg,
      color: colors.text,
      fontFamily: "'Space Mono', 'Courier New', monospace",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: "24px",
      padding: "40px",
    }}>
      <div style={{ color: colors.accent, fontSize: "14px", letterSpacing: "0.25em" }}>SIGNAL ERROR</div>
      <div style={{ color: colors.textMuted, fontSize: "15px", textAlign: "center", maxWidth: "400px", lineHeight: 1.7 }}>{message}</div>
      <button onClick={onReset} style={{ padding: "12px 24px", background: "transparent", border: `1px solid ${colors.border}`, color: colors.textMuted, fontFamily: "inherit", fontSize: "13px", letterSpacing: "0.2em", cursor: "pointer" }}>
        ↩ TRY AGAIN
      </button>
    </div>
  );
}
