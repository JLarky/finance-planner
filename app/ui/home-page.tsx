import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import { Document } from "./document.tsx";
import { shell, button, muted } from "./styles.ts";
export function HomePage(h: Handle<{ signedIn: boolean }>) {
  return () => (
    <Document title="Finance Planner">
      <main mix={shell}>
        <nav mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
          <strong>Finance Planner</strong>
          <a href={h.props.signedIn ? "/app" : "/login"} mix={button({ secondary: true })}>
            {h.props.signedIn ? "Open planner" : "Sign in"}
          </a>
        </nav>
        <section mix={css({ maxWidth: "720px", padding: "96px 0 120px" })}>
          <p
            mix={css({
              color: "#8bbd67",
              fontWeight: 700,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              fontSize: "12px",
            })}
          >
            A calmer view of your money
          </p>
          <h1
            mix={css({
              fontSize: "clamp(42px, 8vw, 78px)",
              lineHeight: 1.02,
              letterSpacing: "-.05em",
              margin: "18px 0",
            })}
          >
            Plan investments with clarity.
          </h1>
          <p mix={css({ ...muted, fontSize: "20px", maxWidth: "570px" })}>
            A private home for understanding what you own, why you own it, and where you want to go
            next.
          </p>
          <a href="/login" mix={button({})}>
            Get started with a passkey →
          </a>
        </section>
        <footer mix={css(muted)}>
          Private by default. Your portfolio data will live in your account.
        </footer>
      </main>
    </Document>
  );
}
