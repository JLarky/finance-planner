import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { redirect } from "remix/response/redirect";
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
export function userId(state: { get(key: string): unknown }): string | null {
  const value = state.get("userId");
  return typeof value === "string" && value ? value : null;
}
export function loginHref(returnTo = "/app") {
  const target = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/app";
  return `/login?returnTo=${encodeURIComponent(target)}`;
}
export function redirectToLogin(returnTo = "/app") {
  return redirect(loginHref(returnTo));
}
export type Challenge = { kind: "register" | "login"; challenge: string; userId?: string };
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
  return (r.kind === "register" || r.kind === "login") && typeof r.challenge === "string"
    ? {
        kind: r.kind,
        challenge: r.challenge,
        userId: typeof r.userId === "string" ? r.userId : undefined,
      }
    : null;
}
