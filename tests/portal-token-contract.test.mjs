import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const portalApi = fs.readFileSync("src/app/api/bookings/[publicId]/route.ts", "utf8");

test("portal api requires token and scopes booking lookup by token", () => {
  assert.equal(portalApi.includes('if (!token)'), true);
  assert.equal(portalApi.includes('status: 401'), true);
  assert.equal(portalApi.includes("findFirst"), true);
  assert.equal(portalApi.includes("customerToken: token"), true);
});

test("portal api returns only timeline-safe event types", () => {
  assert.equal(portalApi.includes('["status_change", "message_sent", "pod_uploaded"]'), true);
});

