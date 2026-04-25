import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [employer, setEmployer] = useState("");
  const [role, setRole] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employer.trim() || !role.trim()) return;
    navigate("/loading", { state: { employer: employer.trim(), role: role.trim() } });
  };

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

      {/* Main */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "60px 40px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "480px" }}>
          <p
            style={{
              fontSize: "11px",
              color: "#444",
              letterSpacing: "0.2em",
              marginBottom: "48px",
              textAlign: "center",
            }}
          >
            YOUR CAREER IS AN ASSET. ACT ACCORDINGLY.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "10px",
                  color: "#555",
                  letterSpacing: "0.2em",
                  marginBottom: "8px",
                }}
              >
                EMPLOYER
              </label>
              <input
                type="text"
                value={employer}
                onChange={(e) => setEmployer(e.target.value)}
                placeholder="Google"
                autoFocus
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #333",
                  color: "#e8e8e8",
                  fontSize: "20px",
                  fontFamily: "inherit",
                  padding: "8px 0",
                  outline: "none",
                  letterSpacing: "0.02em",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "10px",
                  color: "#555",
                  letterSpacing: "0.2em",
                  marginBottom: "8px",
                }}
              >
                ROLE
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Software Engineer"
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #333",
                  color: "#e8e8e8",
                  fontSize: "20px",
                  fontFamily: "inherit",
                  padding: "8px 0",
                  outline: "none",
                  letterSpacing: "0.02em",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={!employer.trim() || !role.trim()}
              style={{
                marginTop: "16px",
                padding: "14px 24px",
                background: "transparent",
                border: "1px solid #ff2222",
                color: employer.trim() && role.trim() ? "#ff2222" : "#3a1a1a",
                fontFamily: "inherit",
                fontSize: "13px",
                letterSpacing: "0.2em",
                cursor: employer.trim() && role.trim() ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (employer.trim() && role.trim()) {
                  (e.target as HTMLButtonElement).style.background = "#ff2222";
                  (e.target as HTMLButtonElement).style.color = "#0a0a0a";
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = "transparent";
                (e.target as HTMLButtonElement).style.color =
                  employer.trim() && role.trim() ? "#ff2222" : "#3a1a1a";
              }}
            >
              ANALYZE POSITION →
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
