import { css } from "remix/ui";
export const shell = css({
  minHeight: "100vh",
  boxSizing: "border-box",
  padding: "28px clamp(20px, 5vw, 72px)",
  background: "#10251d",
  color: "#f1f6ed",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  lineHeight: 1.5,
});
export const muted = { color: "#a5b9ad", lineHeight: 1.6 };
export function button(options?: { secondary?: boolean }) {
  return css({
    display: "inline-block",
    appearance: "none",
    border: options?.secondary ? "1px solid #527061" : "none",
    borderRadius: "999px",
    padding: "12px 18px",
    marginTop: "18px",
    background: options?.secondary ? "transparent" : "#b8e986",
    color: options?.secondary ? "#f1f6ed" : "#10251d",
    font: "inherit",
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
  });
}
