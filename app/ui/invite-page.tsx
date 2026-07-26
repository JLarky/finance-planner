import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import { Document } from "./document.tsx";
import { PasskeyButtons } from "./passkey-buttons.tsx";
import { muted, shell } from "./styles.ts";

export function InvitePage(h: Handle<{ inviteId: string; error: string | null }>) {
  return () => (
    <Document title="Device invite · Finance Planner">
      <main mix={shell}>
        <section
          mix={css({
            maxWidth: "430px",
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
            Device invite
          </p>
          <h1 mix={css({ fontSize: "36px", margin: "12px 0" })}>Link this device.</h1>
          <p mix={css(muted)}>
            Create a new passkey on this device and attach it to the same Finance Planner account.
          </p>
          {h.props.error ? (
            <p mix={css({ color: "#ffc1b8" })}>{h.props.error}</p>
          ) : (
            <PasskeyButtons mode="invite" inviteId={h.props.inviteId} returnTo="/app" />
          )}
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
