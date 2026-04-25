import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/lib/theme";
import { Header } from "@/components/Header";
import { InfiniteGrid } from "@/components/ui/the-infinite-grid";

export default function Home() {
  const [employer, setEmployer] = useState("");
  const [role, setRole] = useState("");
  const navigate = useNavigate();
  const { colors, theme } = useTheme();

  const ready = employer.trim() && role.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    navigate("/loading", { state: { employer: employer.trim(), role: role.trim() } });
  };

  const inputStyle = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${colors.border}`,
    color: colors.text,
    fontSize: "22px",
    fontFamily: "inherit",
    padding: "10px 0",
    outline: "none",
    letterSpacing: "0.02em",
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: colors.bg,
      color: colors.text,
      fontFamily: "'Space Mono', 'Courier New', monospace",
      display: "flex",
      flexDirection: "column",
      position: "relative",
    }}>
      <InfiniteGrid
        aria-hidden="true"
        color={`${colors.accent}${theme === "dark" ? "66" : "26"}`}
        backgroundColor={colors.bg}
        vignetteColor={theme === "dark" ? "rgba(10,10,10,0.96)" : "rgba(245,245,240,0.72)"}
        speed={0.16}
        gridSize={44}
        className="pointer-events-none fixed inset-0 z-0 h-screen"
      />
      <Header />

      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px 24px 60px",
        position: "relative",
        zIndex: 1,
      }}>
        <div style={{ width: "100%", maxWidth: "520px" }}>
          <div style={{
            fontSize: "12px",
            color: colors.accent,
            letterSpacing: "0.22em",
            marginBottom: "14px",
            textAlign: "center",
          }}>
            BUY / HOLD / SELL / SHORT
          </div>
          <p style={{
            fontSize: "15px",
            color: colors.textSecondary,
            letterSpacing: "0.12em",
            lineHeight: 1.7,
            marginBottom: "34px",
            textAlign: "center",
          }}>
            TURN YOUR CURRENT JOB INTO A MARKET VERDICT.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            <div>
              <label style={{
                display: "block",
                fontSize: "13px",
                color: colors.textMuted,
                letterSpacing: "0.18em",
                marginBottom: "10px",
              }}>
                EMPLOYER
              </label>
              <input
                type="text"
                value={employer}
                onChange={(e) => setEmployer(e.target.value)}
                placeholder="Google"
                autoFocus
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{
                display: "block",
                fontSize: "13px",
                color: colors.textMuted,
                letterSpacing: "0.18em",
                marginBottom: "10px",
              }}>
                ROLE
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Software Engineer"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={!ready}
              style={{
                marginTop: "8px",
                padding: "16px 24px",
                background: ready ? colors.accent : "transparent",
                border: `1px solid ${ready ? colors.accent : colors.border}`,
                color: ready ? colors.bg : colors.textMuted,
                fontFamily: "inherit",
                fontSize: "15px",
                letterSpacing: "0.18em",
                fontWeight: ready ? 700 : 400,
                cursor: ready ? "pointer" : "not-allowed",
                transition: "transform 0.15s, opacity 0.15s, border-color 0.15s",
                opacity: ready ? 1 : 0.75,
              }}
              onMouseEnter={(e) => {
                if (ready) {
                  (e.target as HTMLButtonElement).style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.transform = "translateY(0)";
              }}
            >
              ANALYZE POSITION →
            </button>
          </form>
        </div>
      </main>

      <footer style={{
        padding: "16px 40px",
        borderTop: `1px solid ${colors.borderMuted}`,
        display: "flex",
        justifyContent: "space-between",
        fontSize: "12px",
        color: colors.textFaint,
        letterSpacing: "0.12em",
        position: "relative",
        zIndex: 1,
      }}>
        <span>NYSE · NASDAQ · CAREER EXCHANGE</span>
        <span>AI-POWERED · NOT FINANCIAL ADVICE</span>
      </footer>

      <style>{`
        input::placeholder { color: ${colors.textDim}; }
        input { caret-color: ${colors.accent}; }
      `}</style>
    </div>
  );
}
