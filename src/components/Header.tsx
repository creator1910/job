import { useTheme } from "@/lib/theme";

export function Header() {
  const { colors, theme, toggle } = useTheme();

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
      <div style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "0.05em", color: colors.text, flexShrink: 0 }}>
        <span style={{ color: colors.accent }}>$</span>JOB
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "20px", minWidth: 0 }}>
        <div style={{
          fontSize: "13px",
          color: colors.textMuted,
          letterSpacing: "0.12em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
          className="header-status"
        >
          MARKET OPEN · CAREER SIGNALS LIVE
        </div>
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
      <style>{`
        @media (max-width: 540px) {
          .header-status { display: none !important; }
        }
      `}</style>
    </header>
  );
}
