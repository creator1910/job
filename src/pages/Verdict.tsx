import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Verdict as VerdictData, TavilySource } from "@/lib/analyze";
import { useTheme, type Colors } from "@/lib/theme";
import { Header } from "@/components/Header";
import { InfiniteGrid } from "@/components/ui/the-infinite-grid";
import { useScrollFade } from "@/hooks/use-overflow";

function buildTicker(employer: string, role: string): string {
  const emp = employer.trim().split(/\s+/)[0].toUpperCase();
  const roleAbbr = role.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 4);
  return `$${emp}-${roleAbbr}`;
}

function getConfidence(count: number): { label: string; tier: "high" | "moderate" | "limited" | "none" } {
  if (count >= 8) return { label: "HIGH CONFIDENCE", tier: "high" };
  if (count >= 4) return { label: "MODERATE", tier: "moderate" };
  if (count >= 1) return { label: "LIMITED DATA", tier: "limited" };
  return { label: "NO DATA", tier: "none" };
}

function confidenceColor(tier: string, colors: Colors): string {
  if (tier === "high") return colors.verdictColors.BUY;
  if (tier === "moderate") return colors.verdictColors.HOLD;
  if (tier === "limited") return colors.verdictColors.SELL;
  return colors.textMuted;
}

function hostname(url: string): string {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}

function Divider({ colors }: { colors: Colors }) {
  return <div style={{ height: "1px", backgroundColor: colors.borderMuted, margin: "0" }} />;
}

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#!";

export default function Verdict() {
  const location = useLocation();
  const navigate = useNavigate();
  const { colors, theme } = useTheme();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);

  const state = location.state as
    | { employer: string; role: string; verdict: VerdictData; sources: TavilySource[]; researchText: string; error?: never }
    | { employer: string; role: string; error: string; sources?: TavilySource[]; researchText?: string; verdict?: never }
    | null;

  // Animation state
  const prefersReduced = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ).current;

  const [displayVerdict, setDisplayVerdict] = useState<string>("");
  const [convictionCount, setConvictionCount] = useState(0);
  const [barFill, setBarFill] = useState(0);
  const [heroVisible, setHeroVisible] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [convictionVisible, setConvictionVisible] = useState(false);
  const [signalsVisible, setSignalsVisible] = useState(false);
  const [lowerVisible, setLowerVisible] = useState(false);
  const signalsListRef = useRef<HTMLDivElement>(null);
  const notesPanelRef = useRef<HTMLDivElement>(null);
  const sourcesPanelRef = useRef<HTMLDivElement>(null);
  const signalsFade = useScrollFade(signalsListRef, state?.verdict?.signals?.length ?? 0);
  const notesFade = useScrollFade(notesPanelRef, `${notesOpen}-${state?.researchText?.length ?? 0}`);
  const sourcesFade = useScrollFade(sourcesPanelRef, `${sourcesOpen}-${state?.sources?.length ?? 0}`);

  useEffect(() => {
    if (!state) navigate("/");
  }, []);

  useEffect(() => {
    if (!state?.verdict) return;
    const target = state.verdict.verdict;
    const conviction = state.verdict.conviction;

    if (prefersReduced) {
      setDisplayVerdict(target);
      setConvictionCount(conviction);
      setBarFill(conviction);
      setHeroVisible(true);
      setSummaryVisible(true);
      setConvictionVisible(true);
      setSignalsVisible(true);
      setLowerVisible(true);
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

    // ── Signal strength bar + count-up ────────────────────────────────────────
    const t3 = setTimeout(() => {
      setConvictionVisible(true);
      setBarFill(conviction);

      const countDuration = 900;
      const countStart = performance.now();
      const tick = (now: number) => {
        const elapsed = now - countStart;
        const t = Math.min(elapsed / countDuration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        setConvictionCount(Math.round(eased * conviction));
        if (t < 1) requestAnimationFrame(tick);
        else setConvictionCount(conviction);
      };
      requestAnimationFrame(tick);
    }, 720);

    // ── Signals stagger ───────────────────────────────────────────────────────
    const t4 = setTimeout(() => setSignalsVisible(true), 950);

    // ── Accordions + footer ───────────────────────────────────────────────────
    const t5 = setTimeout(() => setLowerVisible(true), 1350);

    return () => {
      clearInterval(scrambleId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, []);

  if (!state) return null;

  if (!state.verdict) {
    return <ErrorScreen message={state.error || "Analysis failed. Please try again."} onReset={() => navigate("/")} colors={colors} />;
  }

  const { employer, role, verdict, sources = [], researchText = "" } = state;
  const ticker = buildTicker(employer, role);
  const verdictColor = colors.verdictColors[verdict.verdict];
  const confidence = getConfidence(sources.length);
  const confColor = confidenceColor(confidence.tier, colors);
  const signals = verdict.signals ?? [];

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
      <Header />

      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        maxWidth: "1280px",
        margin: "0 auto",
        width: "100%",
        minHeight: 0,
        overflow: "hidden",
        padding: "0 40px 14px",
        position: "relative",
        zIndex: 1,
      }}>

        {/* ── Hero ── */}
        <div style={{ padding: "16px 0 12px", textAlign: "center", flexShrink: 0 }}>
          <div style={{
            display: "flex", justifyContent: "center", alignItems: "center", gap: "14px", marginBottom: "12px",
            opacity: heroVisible ? 1 : 0,
            transition: "opacity 0.4s ease-out",
          }}>
            <span style={{ fontSize: "13px", color: colors.textMuted, letterSpacing: "0.2em" }}>{ticker}</span>
            <span style={{ color: colors.border }}>|</span>
            <span style={{ fontSize: "12px", color: confColor, letterSpacing: "0.15em", display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ opacity: 0.6 }}>◉</span>
              {confidence.label}
              {sources.length > 0 && <span style={{ color: colors.textDim }}>· {sources.length}</span>}
            </span>
          </div>

          {/* Verdict word — scramble renders here */}
          <div style={{
            fontSize: "clamp(52px, 11vw, 88px)",
            fontWeight: 900,
            color: verdictColor,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            marginBottom: "8px",
            textShadow: `0 0 60px ${verdictColor}1a`,
            fontVariantNumeric: "tabular-nums",
            minWidth: `${verdict.verdict.length}ch`,
          }}>
            {displayVerdict || verdict.verdict}
          </div>

          <div style={{
            fontSize: "15px",
            color: colors.textSecondary,
            fontStyle: "italic",
            lineHeight: 1.55,
            maxHeight: "48px",
            overflow: "hidden",
            opacity: summaryVisible ? 1 : 0,
            transform: summaryVisible ? "translateY(0)" : "translateY(4px)",
            transition: "opacity 0.35s ease-out, transform 0.35s ease-out",
          }}>
            {verdict.summary}
          </div>
        </div>

        <Divider colors={colors} />

        <div className="verdict-grid" style={{ minHeight: 0, flex: "1 1 auto" }}>
          <section style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
            {/* ── Signal strength ── */}
            <div style={{
              padding: "10px 0",
              flexShrink: 0,
              opacity: convictionVisible ? 1 : 0,
              transform: convictionVisible ? "translateY(0)" : "translateY(6px)",
              transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: colors.textMuted, letterSpacing: "0.2em" }}>SIGNAL STRENGTH</span>
                <span style={{ fontSize: "20px", fontWeight: 700, color: verdictColor, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                  {convictionCount}<span style={{ fontSize: "13px", fontWeight: 400, color: colors.textMuted }}>%</span>
                </span>
              </div>
              <div style={{ width: "100%", height: "2px", backgroundColor: colors.bgElevated }}>
                <div style={{
                  width: `${barFill}%`,
                  height: "100%",
                  backgroundColor: verdictColor,
                  transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)",
                }} />
              </div>
            </div>

            <Divider colors={colors} />

            {/* ── Signals ── */}
            <div style={{ padding: "10px 0 0", flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div style={{
                fontSize: "12px", color: colors.textMuted, letterSpacing: "0.2em", marginBottom: "10px",
                flexShrink: 0,
                opacity: signalsVisible ? 1 : 0,
                transition: "opacity 0.3s ease-out",
              }}>
                SIGNALS
              </div>
              <div
                ref={signalsListRef}
                className="scrollbar-hidden"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  minHeight: 0,
                  overflowY: signalsFade.overflowing ? "auto" : "visible",
                  WebkitMaskImage: signalsFade.maskImage,
                  maskImage: signalsFade.maskImage,
                  paddingRight: signalsFade.overflowing ? "4px" : 0,
                  scrollbarWidth: "none",
                }}
              >
                {signals.length === 0 && (
                  <div style={{
                    color: colors.textMuted,
                    fontSize: "14px",
                    lineHeight: 1.6,
                    letterSpacing: "0.04em",
                    opacity: signalsVisible ? 1 : 0,
                    transition: "opacity 0.35s ease-out",
                  }}>
                    No structured signals returned. Review analyst notes and sources for the evidence trail.
                  </div>
                )}
                {signals.map((signal, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", gap: "10px", alignItems: "flex-start",
                      opacity: signalsVisible ? 1 : 0,
                      transform: signalsVisible ? "translateY(0)" : "translateY(8px)",
                      transition: `opacity 0.35s ease-out ${i * 110}ms, transform 0.35s ease-out ${i * 110}ms`,
                    }}
                  >
                    <div style={{
                      width: "22px",
                      height: "22px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: signal.direction === "up" ? `${colors.verdictColors.BUY}18` : `${colors.verdictColors.SHORT}18`,
                      border: `1px solid ${signal.direction === "up" ? colors.verdictColors.BUY : colors.verdictColors.SHORT}30`,
                      fontSize: "14px",
                      color: signal.direction === "up" ? colors.verdictColors.BUY : colors.verdictColors.SHORT,
                      flexShrink: 0,
                    }}>
                      {signal.direction === "up" ? "↑" : "↓"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "14px", color: colors.textSecondary, lineHeight: 1.55 }}>{signal.text}</span>
                      {signal.url && (
                        <a href={signal.url} target="_blank" rel="noopener noreferrer"
                          style={{ display: "block", marginTop: "2px", fontSize: "11px", color: colors.textDim, textDecoration: "none", letterSpacing: "0.08em" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = colors.textMuted; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = colors.textDim; }}
                        >
                          ↗ {hostname(signal.url)}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
            {/* ── Analyst notes (expandable) ── */}
            {researchText && (
              <div style={{
                flex: notesOpen ? "1 1 auto" : "0 0 auto",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                opacity: lowerVisible ? 1 : 0,
                transform: lowerVisible ? "translateY(0)" : "translateY(6px)",
                transition: "opacity 0.35s ease-out, transform 0.35s ease-out",
              }}>
                <button
                  onClick={() => {
                    setNotesOpen((open) => {
                      const next = !open;
                      if (next) setSourcesOpen(false);
                      return next;
                    });
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    padding: "9px 0",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    color: colors.textMuted,
                    textAlign: "left",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: "12px", letterSpacing: "0.2em" }}>ANALYST NOTES</span>
                  <span style={{ fontSize: "12px", color: colors.textMuted, transition: "transform 0.2s", display: "inline-block", transform: notesOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                </button>
                {notesOpen && (
                  <div ref={notesPanelRef} className="scrollbar-hidden" style={{
                    backgroundColor: colors.bgSurface,
                    border: `1px solid ${colors.border}`,
                    padding: "16px 18px",
                    marginBottom: "2px",
                    fontSize: "13px",
                    color: colors.textMuted,
                    lineHeight: 1.8,
                    letterSpacing: "0.02em",
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflowY: notesFade.overflowing ? "auto" : "visible",
                    WebkitMaskImage: notesFade.maskImage,
                    maskImage: notesFade.maskImage,
                    scrollbarWidth: "none",
                  }}>
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
                        strong: ({ children }) => <strong style={{ color: colors.textSecondary, fontWeight: 700 }}>{children}</strong>,
                        em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
                        ul: ({ children }) => <ul style={{ margin: "6px 0", paddingLeft: "0", listStyle: "none" }}>{children}</ul>,
                        li: ({ children }) => (
                          <li style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "4px" }}>
                            <span style={{ color: colors.accent, flexShrink: 0 }}>·</span>
                            <span>{children}</span>
                          </li>
                        ),
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer"
                            style={{ color: colors.textDim, textDecoration: "underline" }}>{children}</a>
                        ),
                      }}
                    >
                      {researchText}
                    </ReactMarkdown>
                  </div>
                )}
                <Divider colors={colors} />
              </div>
            )}

            {/* ── Sources (expandable) ── */}
            {sources.length > 0 && (
              <div style={{
                flex: sourcesOpen ? "1 1 auto" : "0 0 auto",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                opacity: lowerVisible ? 1 : 0,
                transform: lowerVisible ? "translateY(0)" : "translateY(6px)",
                transition: "opacity 0.35s ease-out 60ms, transform 0.35s ease-out 60ms",
              }}>
                <button
                  onClick={() => {
                    setSourcesOpen((open) => {
                      const next = !open;
                      if (next) setNotesOpen(false);
                      return next;
                    });
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    padding: "9px 0",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    color: colors.textMuted,
                    textAlign: "left",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: "12px", letterSpacing: "0.2em" }}>SOURCES · {sources.length}</span>
                  <span style={{ fontSize: "12px", color: colors.textMuted, transition: "transform 0.2s", display: "inline-block", transform: sourcesOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                </button>
                {sourcesOpen && (
                  <div
                    ref={sourcesPanelRef}
                    className="scrollbar-hidden"
                    style={{
                      flex: "1 1 auto",
                      minHeight: 0,
                      maxHeight: "100%",
                      overflowY: sourcesFade.overflowing ? "auto" : "visible",
                      marginBottom: "2px",
                      WebkitMaskImage: sourcesFade.maskImage,
                      maskImage: sourcesFade.maskImage,
                      scrollbarWidth: "none",
                    }}
                  >
                    {sources.map((src, i) => (
                      <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "18px 1fr auto",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 0",
                          borderBottom: `1px solid ${colors.borderMuted}`,
                          textDecoration: "none",
                          transition: "opacity 0.1s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.5"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
                      >
                        <span style={{ fontSize: "12px", color: colors.textDim, textAlign: "right" }}>{String(i + 1).padStart(2, "0")}</span>
                        <span style={{ fontSize: "13px", color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src.title}</span>
                        <span style={{ fontSize: "11px", color: colors.textDim, flexShrink: 0 }}>{hostname(src.url)} ↗</span>
                      </a>
                    ))}
                  </div>
                )}
                <Divider colors={colors} />
              </div>
            )}

            <div style={{ flex: "1 1 auto", minHeight: "12px" }} />

            {/* ── Footer ── */}
            <div style={{
              display: "flex", alignItems: "center", padding: "12px 0 0",
              flexShrink: 0,
              opacity: lowerVisible ? 1 : 0,
              transition: "opacity 0.35s ease-out 120ms",
            }}>
              <button
                onClick={() => navigate("/")}
                style={{
                  padding: "10px 20px",
                  background: "transparent",
                  border: `1px solid ${colors.border}`,
                  color: colors.textMuted,
                  fontFamily: "inherit",
                  fontSize: "13px",
                  letterSpacing: "0.2em",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                  width: "100%",
                }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = colors.textMuted; el.style.color = colors.textSecondary; }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = colors.border; el.style.color = colors.textMuted; }}
              >
                ↩ NEW POSITION
              </button>
            </div>
          </aside>
        </div>

        <style>{`
          .verdict-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.45fr) minmax(380px, 0.95fr);
            gap: 40px;
          }
          @media (max-width: 860px) {
            .verdict-grid {
              grid-template-columns: minmax(0, 1fr);
              gap: 0;
            }
          }
          @media (max-width: 540px) {
            .verdict-grid {
              font-size: 13px;
            }
          }
          .scrollbar-hidden::-webkit-scrollbar { display: none; }
        `}</style>

      </main>
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
