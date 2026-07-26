import { clientEntry, css, on, type Handle } from "remix/ui";
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
export const PasskeyButtons = clientEntry(
  "/app/ui/passkey-buttons.tsx",
  function PasskeyButtons(h: Handle<{ mode: "login"; returnTo: string; error?: string | null }>) {
    let busy = false;
    let error = h.props.error ?? null;
    async function post(url: string, body?: unknown) {
      const r = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: body == null ? undefined : JSON.stringify(body),
      });
      const j = (await r.json()) as Record<string, unknown>;
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Request failed");
      return j;
    }
    async function run(kind: "register" | "login") {
      const options = await post(`/api/auth/${kind}/options`);
      const response =
        kind === "register"
          ? await startRegistration({ optionsJSON: options as never })
          : await startAuthentication({ optionsJSON: options as never });
      await post(`/api/auth/${kind}/verify`, { response });
      window.location.href = h.props.returnTo || "/app";
    }
    async function click(kind: "register" | "login") {
      if (busy) return;
      if (!browserSupportsWebAuthn()) {
        error = "This browser does not support passkeys.";
        void h.update();
        return;
      }
      busy = true;
      error = null;
      void h.update();
      try {
        await run(kind);
      } catch (e) {
        error = e instanceof Error ? e.message : "Passkey failed";
        busy = false;
        void h.update();
      }
    }
    return () => (
      <div mix={css({ display: "flex", flexDirection: "column", gap: "12px", marginTop: "24px" })}>
        {error ? <p mix={css({ color: "#ffb4a8", margin: 0 })}>{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          mix={[
            css({
              border: 0,
              borderRadius: "10px",
              padding: "13px",
              font: "inherit",
              fontWeight: 700,
              cursor: "pointer",
              background: "#b8e986",
              color: "#10251d",
            }),
            on("click", () => void click("register")),
          ]}
        >
          {busy ? "Waiting for passkey…" : "Create account with passkey"}
        </button>
        <button
          type="button"
          disabled={busy}
          mix={[
            css({
              border: "1px solid #527061",
              borderRadius: "10px",
              padding: "13px",
              font: "inherit",
              fontWeight: 700,
              cursor: "pointer",
              background: "transparent",
              color: "#f1f6ed",
            }),
            on("click", () => void click("login")),
          ]}
        >
          {busy ? "Waiting for passkey…" : "Sign in with existing passkey"}
        </button>
      </div>
    );
  },
);
