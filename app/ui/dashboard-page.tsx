import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import type { User } from "../data/users.ts";
import { Document } from "./document.tsx";
import { shell, muted, button } from "./styles.ts";
export function DashboardPage(h: Handle<{ user: User }>) {
  return () => (
    <Document title="Your plan · Finance Planner">
      <main mix={shell}>
        <header
          mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}
        >
          <strong>Finance Planner</strong>
          <form method="POST" action="/logout">
            <button mix={button({ secondary: true })}>Sign out</button>
          </form>
        </header>
        <section mix={css({ padding: "72px 0" })}>
          <p
            mix={css({
              color: "#8bbd67",
              fontWeight: 700,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              fontSize: "12px",
            })}
          >
            Your private workspace
          </p>
          <h1 mix={css({ fontSize: "48px", margin: "14px 0" })}>Your investment plan</h1>
          <p mix={css(muted)}>
            The foundation is ready. Next we can add holdings, goals, contributions, and the views
            that make this useful for you.
          </p>
          <div
            mix={css({
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "14px",
              marginTop: "40px",
            })}
          >
            {["Portfolio overview", "Goals", "Activity"].map((label) => (
              <article
                key={label}
                mix={css({
                  border: "1px solid #315244",
                  borderRadius: "16px",
                  padding: "22px",
                  background: "#183127",
                })}
              >
                <strong>{label}</strong>
                <p mix={css(muted)}>Coming next</p>
              </article>
            ))}
          </div>
          <p mix={css({ ...muted, marginTop: "48px", fontSize: "12px" })}>
            Account created {new Date(h.props.user.createdAt).toLocaleDateString()}
          </p>
        </section>
      </main>
    </Document>
  );
}
