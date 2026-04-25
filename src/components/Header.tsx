import { useTheme } from "@/lib/theme";

export function Header() {
  const { colors, theme, toggle } = useTheme();

  return (
    <header style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "20px 40px",
      borderBottom: `1px solid ${colors.border}`,
    }}>
      <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "0.05em", color: colors.text }}>
        <span style={{ color: colors.accent }}>$</span>JOB
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <div style={{ fontSize: "11px", color: colors.textMuted, letterSpacing: "0.15em" }}>
          MARKET OPEN · CAREER SIGNALS LIVE
        </div>
        <button
          onClick={toggle}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          style={{
            background: "transparent",
            border: `1px solid ${colors.border}`,
            color: colors.textMuted,
            fontFamily: "inherit",
            fontSize: "10px",
            letterSpacing: "0.15em",
            padding: "4px 10px",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = colors.textMuted;
            el.style.color = colors.textSecondary;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = colors.border;
            el.style.color = colors.textMuted;
          }}
        >
          {theme === "dark" ? "◐ LIGHT" : "◑ DARK"}
        </button>
      </div>
    </header>
  );
}
