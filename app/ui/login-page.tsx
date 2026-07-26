import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import { Document } from "./document.tsx";
import { PasskeyButtons } from "./passkey-buttons.tsx";
import { shell, muted } from "./styles.ts";
export function LoginPage(
  h: Handle<{ returnTo: string; error: string | null; devAuthEnabled: boolean }>,
) {
  return () => (
    <Document title="Sign in · Finance Planner">
      <main mix={shell}>
        <section
          mix={css({
            width: "100%",
            maxWidth: "430px",
            margin: "96px auto",
            background: "#183127",
            border: "1px solid #315244",
            borderRadius: "24px",
            padding: "32px",
            boxSizing: "border-box",
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
          <h1 mix={css({ fontSize: "36px", margin: "12px 0" })}>Welcome back.</h1>
          <p mix={css(muted)}>
            Create an account or sign in using the passkey stored on this device.
          </p>
          <PasskeyButtons mode="login" returnTo={h.props.returnTo} error={h.props.error} />
          {h.props.devAuthEnabled ? (
            <form method="POST" action="/dev-login">
              <button
                type="submit"
                mix={css({
                  border: "1px dashed #7fae5c",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  width: "100%",
                  marginTop: "12px",
                  font: "inherit",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: "transparent",
                  color: "#b8e986",
                })}
              >
                Use local dev account
              </button>
              <p mix={css({ ...muted, fontSize: "12px", margin: "8px 0 0" })}>
                Only available when DEV_AUTH_BYPASS=1 in local development.
              </p>
            </form>
          ) : null}
          <a
            href="/"
            mix={css({ ...muted, display: "block", marginTop: "24px", fontSize: "13px" })}
          >
            Back home
          </a>
        </section>
      </main>
    </Document>
  );
}
