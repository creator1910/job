import { useNavigate } from "react-router-dom";
import { useTheme } from "@/lib/theme";

export function Header({ accentColor }: { accentColor?: string } = {}) {
  const navigate = useNavigate();
  const { colors, theme, toggle } = useTheme();
  const dollarColor = accentColor ?? colors.accent;

  return (
    <header style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0 24px",
      height: "56px",
      flexShrink: 0,
      borderBottom: `1px solid ${colors.border}`,
      position: "relative",
      zIndex: 2,
    }}>
      <button
        type="button"
        onClick={() => navigate("/")}
        title="Back to start"
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "26px",
          fontWeight: 700,
          letterSpacing: "0.05em",
          color: colors.text,
          flexShrink: 0,
        }}
      >
        <span style={{ color: dollarColor, transition: "color 0.4s ease-out" }}>$</span>JOB
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: "20px", minWidth: 0 }}>
        <button
          onClick={toggle}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          style={{
            background: "transparent",
            border: `1px solid ${colors.borderMuted}`,
            color: colors.textDim,
            fontFamily: "inherit",
            fontSize: "12px",
            letterSpacing: "0.12em",
            padding: "0 10px",
            cursor: "pointer",
            transition: "all 0.15s",
            flexShrink: 0,
            height: "32px",
            minWidth: "70px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = colors.textMuted;
            el.style.color = colors.textSecondary;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = colors.borderMuted;
            el.style.color = colors.textDim;
          }}
        >
          {theme === "dark" ? "◐ LIGHT" : "◑ DARK"}
        </button>
      </div>
    </header>
  );
}
