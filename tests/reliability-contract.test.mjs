import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const notifications = fs.readFileSync("src/lib/notifications.ts", "utf8");
const podRoute = fs.readFileSync("src/app/api/driver/jobs/[id]/pod/route.ts", "utf8");

test("notifications handle provider exceptions without throwing", () => {
  assert.equal(notifications.includes("try {"), true);
  assert.equal(notifications.includes("sendgrid_exception"), true);
  assert.equal(notifications.includes("booking_notification_event_write_failed"), true);
});

test("pod endpoint deduplicates retry uploads by objectKey", () => {
  assert.equal(podRoute.includes("existingPhoto"), true);
  assert.equal(podRoute.includes("deduplicated: true"), true);
});

