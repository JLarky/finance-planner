import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createCookieSessionStorage } from "remix/session-storage/cookie";

const cookie = createCookie("__finance_planner_session", {
  secrets: [process.env.SESSION_SECRET ?? "finance-planner-local-session-secret"],
  httpOnly: true,
  sameSite: "Lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
});
const storage = createCookieSessionStorage();
export function authSession() {
  return session(cookie, storage);
}
export function devAuthEnabled(): boolean {
  return (
    process.env.DEV_AUTH_BYPASS === "1" &&
    process.env.NODE_ENV !== "production" &&
    !process.env.DENO_DEPLOYMENT_ID
  );
}
export function userId(state: { get(key: string): unknown }): string | null {
  const value = state.get("userId");
  return typeof value === "string" && value ? value : null;
}
export type Challenge = {
  kind: "register" | "login" | "invite";
  challenge: string;
  userId?: string;
  inviteId?: string;
};
export function setChallenge(state: { set(k: string, v: unknown): void }, value: Challenge) {
  state.set("challenge", value);
}
export function takeChallenge(state: {
  get(k: string): unknown;
  unset(k: string): void;
}): Challenge | null {
  const value = state.get("challenge");
  state.unset("challenge");
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  return (r.kind === "register" || r.kind === "login" || r.kind === "invite") &&
    typeof r.challenge === "string"
    ? {
        kind: r.kind,
        challenge: r.challenge,
        userId: typeof r.userId === "string" ? r.userId : undefined,
        inviteId: typeof r.inviteId === "string" ? r.inviteId : undefined,
      }
    : null;
}
