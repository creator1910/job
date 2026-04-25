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
    }}>
      <Header />

      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px 24px 60px",
      }}>
        <div style={{ width: "100%", maxWidth: "520px" }}>
          <p style={{
            fontSize: "14px",
            color: colors.textMuted,
            letterSpacing: "0.18em",
            marginBottom: "40px",
            textAlign: "center",
          }}>
            YOUR CAREER IS AN ASSET. ACT ACCORDINGLY.
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
                background: "transparent",
                border: `1px solid ${ready ? colors.accent : colors.border}`,
                color: ready ? colors.accent : colors.textMuted,
                fontFamily: "inherit",
                fontSize: "15px",
                letterSpacing: "0.18em",
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
        fontSize: "12px",
        color: colors.textFaint,
        letterSpacing: "0.12em",
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
