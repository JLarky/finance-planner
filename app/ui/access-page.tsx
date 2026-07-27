import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import { Document } from "./document.tsx";
import { button, muted, shell } from "./styles.ts";

export function AccessPage(
  h: Handle<{ destination: string; title: string; detail: string; staleSession?: boolean }>,
) {
  const { destination, title, detail, staleSession } = h.props;
  return () => (
    <Document title={`${title} · Finance Planner`}>
      <main mix={shell}>
        <section
          mix={css({
            maxWidth: "480px",
            margin: "96px auto",
            padding: "32px",
            background: "#183127",
            border: "1px solid #315244",
            borderRadius: "24px",
          })}
        >
          <p
            mix={css({
              color: "#b8e986",
              fontWeight: 700,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              fontSize: "12px",
            })}
          >
            Finance Planner
          </p>
          <h1 mix={css({ fontSize: "36px", margin: "12px 0" })}>{title}</h1>
          <p mix={css(muted)}>{detail}</p>
          <div mix={css({ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "24px" })}>
            <a href={`/login?returnTo=${encodeURIComponent(destination)}`} mix={button()}>
              Go to sign in
            </a>
            <a href="/" mix={button({ secondary: true })}>
              Back home
            </a>
          </div>
          {staleSession ? (
            <form method="POST" action="/logout" mix={css({ marginTop: "12px" })}>
              <button type="submit" mix={button({ secondary: true })}>
                Sign out this session
              </button>
            </form>
          ) : null}
        </section>
      </main>
    </Document>
  );
}
