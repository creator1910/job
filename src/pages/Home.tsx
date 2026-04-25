import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/lib/theme";
import { Header } from "@/components/Header";

export default function Home() {
  const [employer, setEmployer] = useState("");
  const [role, setRole] = useState("");
  const navigate = useNavigate();
  const { colors } = useTheme();

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
    fontSize: "20px",
    fontFamily: "inherit",
    padding: "8px 0",
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
    }}>
      <Header />

      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "60px 40px",
      }}>
        <div style={{ width: "100%", maxWidth: "480px" }}>
          <p style={{
            fontSize: "11px",
            color: colors.textMuted,
            letterSpacing: "0.2em",
            marginBottom: "48px",
            textAlign: "center",
          }}>
            YOUR CAREER IS AN ASSET. ACT ACCORDINGLY.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            <div>
              <label style={{
                display: "block",
                fontSize: "10px",
                color: colors.textMuted,
                letterSpacing: "0.2em",
                marginBottom: "8px",
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
                fontSize: "10px",
                color: colors.textMuted,
                letterSpacing: "0.2em",
                marginBottom: "8px",
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
                marginTop: "16px",
                padding: "14px 24px",
                background: "transparent",
                border: `1px solid ${ready ? colors.accent : colors.border}`,
                color: ready ? colors.accent : colors.textMuted,
                fontFamily: "inherit",
                fontSize: "13px",
                letterSpacing: "0.2em",
                cursor: ready ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (ready) {
                  (e.target as HTMLButtonElement).style.background = colors.accent;
                  (e.target as HTMLButtonElement).style.color = colors.bg;
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = "transparent";
                (e.target as HTMLButtonElement).style.color = ready ? colors.accent : colors.textMuted;
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
        fontSize: "10px",
        color: colors.textFaint,
        letterSpacing: "0.15em",
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
