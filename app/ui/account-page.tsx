import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import type { DeviceInvite, User } from "../data/users.ts";
import { Document } from "./document.tsx";
import { button, muted, shell } from "./styles.ts";

export function AccountPage(
  h: Handle<{
    user: User;
    pendingInvites: DeviceInvite[];
    notice: string | null;
    error: string | null;
  }>,
) {
  const { user, pendingInvites, notice, error } = h.props;
  return () => (
    <Document title="Account · Finance Planner">
      <main mix={shell}>
        <div mix={css({ maxWidth: "820px", margin: "0 auto" })}>
          <header
            mix={css({
              display: "flex",
              justifyContent: "space-between",
              gap: "20px",
              alignItems: "center",
            })}
          >
            <div>
              <p mix={eyebrow}>Account settings</p>
              <h1 mix={css({ fontSize: "clamp(36px, 6vw, 56px)", margin: "12px 0" })}>
                Your devices
              </h1>
              <p mix={css(muted)}>
                Use a one-time invite to add another passkey to this same account.
              </p>
            </div>
            <a href="/app" mix={button({ secondary: true })}>
              Back to planner
            </a>
          </header>
          {notice ? <p mix={noticeStyle}>{notice}</p> : null}
          {error ? <p mix={errorStyle}>{error}</p> : null}
          <section mix={panel}>
            <h2 mix={heading}>Passkeys</h2>
            <p mix={css(muted)}>
              Each passkey is a separate way to sign in. Your portfolio remains shared.
            </p>
            <div mix={list}>
              {user.passkeys.map((passkey) => (
                <div key={passkey.credentialId} mix={row}>
                  <strong>{passkey.label}</strong>
                  <span mix={css(muted)}>Added {passkey.createdAt.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          </section>
          <section mix={panel}>
            <h2 mix={heading}>Add another device</h2>
            <p mix={css(muted)}>
              Create a one-time link, then open it on the device you want to connect. Links expire
              after seven days.
            </p>
            <form method="POST" action="/account">
              <input type="hidden" name="intent" value="create-device-invite" />
              <button type="submit" mix={button()}>
                Create device invite
              </button>
            </form>
            {pendingInvites.length ? (
              <div mix={list}>
                {pendingInvites.map((invite) => (
                  <div key={invite.id} mix={row}>
                    <div>
                      <strong>Pending invite</strong>
                      <span mix={css(muted)}>Expires {invite.expiresAt.slice(0, 10)}</span>
                    </div>
                    <div mix={css({ display: "flex", gap: "12px", alignItems: "center" })}>
                      <code mix={code}>/invite/{invite.id}</code>
                      <form method="POST" action="/account">
                        <input type="hidden" name="intent" value="revoke-device-invite" />
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <button type="submit" mix={linkButton}>
                          Revoke
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </Document>
  );
}

const panel = css({
  marginTop: "24px",
  padding: "24px",
  border: "1px solid #315244",
  borderRadius: "18px",
  background: "#183127",
});
const heading = css({ margin: 0, fontSize: "20px" });
const eyebrow = css({
  color: "#b8e986",
  fontWeight: 700,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontSize: "12px",
  margin: 0,
});
const list = css({ display: "grid", gap: "10px", marginTop: "18px" });
const row = css({
  display: "flex",
  justifyContent: "space-between",
  gap: "18px",
  alignItems: "center",
  padding: "14px 16px",
  border: "1px solid #315244",
  borderRadius: "12px",
  background: "#10251d",
});
const code = css({ overflowWrap: "anywhere", color: "#b8e986", fontSize: "12px" });
const linkButton = css({
  border: 0,
  background: "transparent",
  color: "#b8e986",
  font: "inherit",
  textDecoration: "underline",
  cursor: "pointer",
});
const noticeStyle = css({
  padding: "12px 16px",
  borderRadius: "10px",
  background: "#294a35",
  color: "#d9f2c1",
});
const errorStyle = css({
  padding: "12px 16px",
  borderRadius: "10px",
  background: "#542d2a",
  color: "#ffc1b8",
});
