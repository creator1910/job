import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import type { Verdict as VerdictData } from "@/lib/analyze";

const VERDICT_COLORS = {
  BUY: "#00cc66",
  HOLD: "#cccc00",
  SELL: "#ff8800",
  SHORT: "#ff2222",
};

function buildTicker(employer: string, role: string): string {
  const emp = employer.trim().split(/\s+/)[0].toUpperCase();
  const roleAbbr = role
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 4);
  return `$${emp}-${roleAbbr}`;
}

export default function Verdict() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as
    | { employer: string; role: string; verdict: VerdictData; error?: never }
    | { employer: string; role: string; error: string; verdict?: never }
    | null;

  // D2: null guard — redirect to home if no state
  useEffect(() => {
    if (!state) navigate("/");
  }, []);

  if (!state) return null;

  if (state.error) {
    return (
      <ErrorScreen message={state.error} onReset={() => navigate("/")} />
    );
  }

  const { employer, role, verdict } = state;
  const ticker = buildTicker(employer, role);
  const color = VERDICT_COLORS[verdict.verdict];

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0a0a",
        color: "#e8e8e8",
        fontFamily: "'Geist Mono', 'Courier New', monospace",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 40px",
          borderBottom: "1px solid #1e1e1e",
        }}
      >
        <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "0.05em" }}>
          <span style={{ color: "#ff2222" }}>$</span>JOB
        </div>
        <div style={{ fontSize: "11px", color: "#666", letterSpacing: "0.15em" }}>
          MARKET OPEN · CAREER SIGNALS LIVE
        </div>
      </header>

      {/* Main verdict */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "40px",
          maxWidth: "720px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Ticker */}
        <div
          style={{
            fontSize: "13px",
            color: "#555",
            letterSpacing: "0.25em",
            marginBottom: "16px",
          }}
        >
          {ticker}
        </div>

        {/* Verdict word */}
        <div
          style={{
            fontSize: "clamp(48px, 12vw, 96px)",
            fontWeight: 900,
            color,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            marginBottom: "8px",
          }}
        >
          {verdict.verdict}
        </div>

        {/* Summary */}
        <div
          style={{
            fontSize: "14px",
            color: "#888",
            marginBottom: "40px",
            textAlign: "center",
            fontStyle: "italic",
          }}
        >
          {verdict.summary}
        </div>

        {/* Conviction */}
        <div style={{ width: "100%", marginBottom: "40px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "10px",
              color: "#444",
              letterSpacing: "0.2em",
              marginBottom: "8px",
            }}
          >
            <span>CONVICTION</span>
            <span style={{ color }}>{verdict.conviction}%</span>
          </div>
          <div style={{ width: "100%", height: "3px", backgroundColor: "#1a1a1a" }}>
            <div
              style={{
                width: `${verdict.conviction}%`,
                height: "100%",
                backgroundColor: color,
                transition: "width 0.8s ease-out",
              }}
            />
          </div>
        </div>

        {/* Signals */}
        <div style={{ width: "100%", marginBottom: "48px" }}>
          <div
            style={{
              fontSize: "10px",
              color: "#444",
              letterSpacing: "0.2em",
              marginBottom: "16px",
            }}
          >
            SIGNAL BREAKDOWN
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {verdict.signals.map((signal, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                  padding: "12px 0",
                  borderBottom: "1px solid #141414",
                }}
              >
                <span
                  style={{
                    fontSize: "16px",
                    color: signal.direction === "up" ? "#00cc66" : "#ff2222",
                    flexShrink: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {signal.direction === "up" ? "↑" : "↓"}
                </span>
                <span style={{ fontSize: "13px", color: "#aaa", lineHeight: 1.5 }}>
                  {signal.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "12px 24px",
              background: "transparent",
              border: "1px solid #333",
              color: "#666",
              fontFamily: "inherit",
              fontSize: "11px",
              letterSpacing: "0.2em",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.borderColor = "#666";
              (e.target as HTMLButtonElement).style.color = "#aaa";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.borderColor = "#333";
              (e.target as HTMLButtonElement).style.color = "#666";
            }}
          >
            ↩ NEW POSITION
          </button>
          <p style={{ fontSize: "10px", color: "#2a2a2a", textAlign: "center", maxWidth: "400px" }}>
            Not financial or career advice. Rotate API keys after demo.
          </p>
        </div>
      </main>
    </div>
  );
}

function ErrorScreen({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0a0a",
        color: "#e8e8e8",
        fontFamily: "'Geist Mono', 'Courier New', monospace",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "24px",
        padding: "40px",
      }}
    >
      <div style={{ color: "#ff2222", fontSize: "13px", letterSpacing: "0.2em" }}>SIGNAL ERROR</div>
      <div style={{ color: "#555", fontSize: "13px", textAlign: "center", maxWidth: "400px" }}>
        {message}
      </div>
      <button
        onClick={onReset}
        style={{
          padding: "12px 24px",
          background: "transparent",
          border: "1px solid #333",
          color: "#666",
          fontFamily: "inherit",
          fontSize: "11px",
          letterSpacing: "0.2em",
          cursor: "pointer",
        }}
      >
        ↩ TRY AGAIN
      </button>
    </div>
  );
}
