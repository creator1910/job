import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { analyzePosition, type ProgressStep, type TavilySource } from "@/lib/analyze";
import { useTheme } from "@/lib/theme";
import { Header } from "@/components/Header";

export default function Loading() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { employer: string; role: string } | null;
  const called = useRef(false);
  const { colors } = useTheme();

  const [phase, setPhase] = useState<"idle" | "searching" | "analyzing">("idle");
  const [sources, setSources] = useState<TavilySource[]>([]);
  const [analysisText, setAnalysisText] = useState("");

  const sourcesRef = useRef<TavilySource[]>([]);
  const analysisTextRef = useRef("");

  const onProgress = (step: ProgressStep) => {
    if (step.type === "searching") setPhase("searching");
    if (step.type === "source_found") {
      setSources((prev) => { const next = [...prev, step.source]; sourcesRef.current = next; return next; });
    }
    if (step.type === "search_complete") {
      setSources(step.sources);
      sourcesRef.current = step.sources;
    }
    if (step.type === "analyzing") setPhase("analyzing");
    if (step.type === "analysis_token") {
      setAnalysisText((t) => { const next = t + step.text; analysisTextRef.current = next; return next; });
    }
  };

  useEffect(() => {
    if (!state) { navigate("/"); return; }
    if (called.current) return;
    called.current = true;

    analyzePosition(state.employer, state.role, onProgress)
      .then((verdict) => {
        navigate("/verdict", {
          state: {
            employer: state.employer,
            role: state.role,
            verdict,
            sources: sourcesRef.current,
            researchText: analysisTextRef.current,
          },
        });
      })
      .catch((err: unknown) => {
        console.error("[Loading] analyzePosition failed:", err);
        const msg = err instanceof Error ? err.message : String(err);
        navigate("/verdict", {
          state: {
            employer: state.employer,
            role: state.role,
            error: msg,
            sources: sourcesRef.current,
            researchText: analysisTextRef.current,
          },
        });
      });
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: colors.bg,
      color: colors.text,
      fontFamily: "'Space Mono', 'Courier New', monospace",
      display: "flex",
      flexDirection: "column",
    }}>
      <Header />

      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "40px 24px",
        maxWidth: "680px",
        margin: "0 auto",
        width: "100%",
        gap: "32px",
      }}>
        {/* Position + spinner */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Spinner accentColor={colors.accent} bgColor={colors.bgElevated} />
          {state && (
            <div>
              <div style={{ fontSize: "10px", color: colors.textMuted, letterSpacing: "0.2em" }}>ANALYZING</div>
              <div style={{ fontSize: "15px", color: colors.textSecondary, marginTop: "4px", letterSpacing: "0.04em" }}>
                {state.employer} / {state.role}
              </div>
            </div>
          )}
        </div>

        {/* Search results feed */}
        <div>
          <div style={{
            fontSize: "10px",
            color: phase === "searching" ? colors.accent : colors.textMuted,
            letterSpacing: "0.2em",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            {phase === "searching"
              ? <span style={{ animation: "blink 1s ease-in-out infinite" }}>◈</span>
              : <span style={{ color: colors.textDim }}>✓</span>
            }
            WEB SEARCH
            {sources.length > 0 && (
              <span style={{ color: colors.textDim, marginLeft: "auto" }}>{sources.length} sources</span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", minHeight: "120px" }}>
            {sources.length === 0 && phase === "searching" && (
              <div style={{ fontSize: "11px", color: colors.textDim, letterSpacing: "0.05em", animation: "blink 1.2s ease-in-out infinite" }}>
                scanning...
              </div>
            )}
            {sources.map((src, i) => (
              <SourceRow key={i} source={src} index={i} colors={colors} />
            ))}
          </div>
        </div>

        {/* Analysis stream */}
        {(phase === "analyzing" || analysisText) && (
          <div>
            <div style={{
              fontSize: "10px",
              color: colors.accent,
              letterSpacing: "0.2em",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}>
              <span style={{ animation: "blink 1s ease-in-out infinite" }}>◆</span>
              SYNTHESIZING VERDICT
            </div>
            <div style={{
              fontSize: "12px",
              color: colors.textSecondary,
              lineHeight: 1.7,
              letterSpacing: "0.03em",
              minHeight: "60px",
            }}>
              {analysisText}
              {analysisText && <span style={{ animation: "blink 0.7s ease-in-out infinite", color: colors.accent }}>▌</span>}
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:0.2} 50%{opacity:1} }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function SourceRow({ source, index, colors }: { source: TavilySource; index: number; colors: ReturnType<typeof useTheme>["colors"] }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "baseline",
      gap: "10px",
      animation: "fadeSlideIn 0.25s ease-out both",
      animationDelay: `${index * 40}ms`,
    }}>
      <span style={{ fontSize: "9px", color: colors.textDim, flexShrink: 0, letterSpacing: "0.1em" }}>
        {String(index + 1).padStart(2, "0")}
      </span>
      <span style={{ fontSize: "11px", color: colors.textSecondary, letterSpacing: "0.02em", lineHeight: 1.4 }}>
        {source.title}
      </span>
      <span style={{ fontSize: "9px", color: colors.textDim, letterSpacing: "0.05em", flexShrink: 0, marginLeft: "auto" }}>
        {(() => { try { return new URL(source.url).hostname.replace("www.", ""); } catch { return ""; } })()}
      </span>
    </div>
  );
}

function Spinner({ accentColor, bgColor }: { accentColor: string; bgColor: string }) {
  return (
    <div style={{
      width: "20px",
      height: "20px",
      flexShrink: 0,
      border: `2px solid ${bgColor}`,
      borderTop: `2px solid ${accentColor}`,
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }} />
  );
}
