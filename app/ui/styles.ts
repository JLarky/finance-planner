import { css } from "remix/ui";
export const shell = css({
  minHeight: "100vh",
  boxSizing: "border-box",
  padding: "28px clamp(20px, 5vw, 72px)",
  background: "radial-gradient(circle at 80% -10%, #254c38 0, transparent 38%), #10251d",
  color: "#f1f6ed",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  lineHeight: 1.5,
  "& input:not([type=checkbox]), & select": {
    width: "100%",
    minHeight: "46px",
    boxSizing: "border-box",
    border: "1px solid #527061",
    borderRadius: "10px",
    padding: "10px 12px",
    background: "#10251d",
    color: "#f1f6ed",
    font: "inherit",
    fontSize: "15px",
    outline: "none",
    transition: "border-color 150ms ease, box-shadow 150ms ease",
    "&:focus": { borderColor: "#b8e986", boxShadow: "0 0 0 3px #b8e98633" },
  },
  "& input[type=checkbox]": { accentColor: "#b8e986", width: "16px", height: "16px" },
  "& form > label": {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "#d4e1d8",
    fontSize: "14px",
  },
  "& form > label:has(input[type=checkbox])": {
    flexDirection: "row",
    alignItems: "center",
    gap: "9px",
    fontSize: "13px",
  },
  "& button:disabled": { opacity: 0.5, cursor: "not-allowed" },
});
export const muted = { color: "#a5b9ad", lineHeight: 1.6 };
export function button(options?: { secondary?: boolean }) {
  return css({
    display: "inline-block",
    appearance: "none",
    border: options?.secondary ? "1px solid #527061" : "none",
    borderRadius: "999px",
    padding: "12px 18px",
    marginTop: "8px",
    background: options?.secondary ? "transparent" : "#b8e986",
    color: options?.secondary ? "#f1f6ed" : "#10251d",
    font: "inherit",
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
    transition: "transform 150ms ease, background 150ms ease, border-color 150ms ease",
    "&:hover": { transform: "translateY(-1px)" },
  });
}
