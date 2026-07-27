import assert from "node:assert/strict";
import test from "node:test";
import { bindUserSession, userId } from "../app/middleware/auth-session.ts";

void test("session identity is bound to its exact hostname", () => {
  const values = new Map<string, unknown>();
  const state = {
    get: (key: string) => values.get(key),
    set: (key: string, value: unknown) => values.set(key, value),
  };
  bindUserSession(state, new Request("https://finance-planner.example/app"), "user-1");

  assert.equal(userId(state, new Request("https://finance-planner.example/app")), "user-1");
  assert.equal(userId(state, new Request("https://finance-planner-preview.example/app")), null);
});
