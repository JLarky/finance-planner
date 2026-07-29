import assert from "node:assert/strict";
import test from "node:test";
import { KV_NAMESPACE, kvKey } from "../app/data/kv.ts";

void test("Finance Planner KV keys use an app-specific namespace", () => {
  assert.equal(KV_NAMESPACE, "finance-planner");
  assert.deepEqual(kvKey("user", "example"), ["finance-planner", "user", "example"]);
});
