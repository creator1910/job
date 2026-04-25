import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { analyzePosition } from "@/lib/analyze";

export default function Loading() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { employer: string; role: string } | null;
  const called = useRef(false);

  useEffect(() => {
    if (!state) {
      navigate("/");
      return;
    }
    if (called.current) return;
    called.current = true;

    analyzePosition(state.employer, state.role)
      .then((verdict) => {
        navigate("/verdict", { state: { employer: state.employer, role: state.role, verdict } });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        navigate("/verdict", {
          state: {
            employer: state.employer,
            role: state.role,
            error: msg,
          },
        });
      });
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0a0a",
        color: "#e8e8e8",
        fontFamily: "'Space Mono', 'Courier New', monospace",
        display: "flex",
        flexDirection: "column",
      }}
    >
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

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "24px",
        }}
      >
        <Spinner />
        <p
          style={{
            fontSize: "12px",
            letterSpacing: "0.25em",
            color: "#666",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        >
          ANALYZING MARKET SIGNALS...
        </p>
        {state && (
          <p style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em" }}>
            {state.employer.toUpperCase()} / {state.role.toUpperCase()}
          </p>
        )}
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: "32px",
        height: "32px",
        border: "2px solid #1e1e1e",
        borderTop: "2px solid #ff2222",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}
