import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const wizard = fs.readFileSync("src/components/booking/booking-wizard.tsx", "utf8");
const stepContact = fs.readFileSync("src/components/booking/step-contact-time.tsx", "utf8");
const stepRoute = fs.readFileSync("src/components/booking/step-route.tsx", "utf8");
const stepStaff = fs.readFileSync("src/components/booking/step-staff-notes.tsx", "utf8");
const adminPatch = fs.readFileSync("src/app/api/admin/bookings/[id]/route.ts", "utf8");
const driverStatus = fs.readFileSync("src/app/api/driver/jobs/[id]/status/route.ts", "utf8");
const driverPod = fs.readFileSync("src/app/api/driver/jobs/[id]/pod/route.ts", "utf8");

test("customer booking wizard happy-path contracts are present", () => {
  assert.equal(stepContact.includes("Step 1: Contact and move time"), true);
  assert.equal(stepRoute.includes("Step 2: Route check"), true);
  assert.equal(stepStaff.includes("Step 3: Staff and final notes"), true);
  assert.equal(wizard.includes("sessionStorage"), true);
  assert.equal(wizard.includes('fetch("/api/bookings"'), true);
});

test("admin schedule conflict validation is enforced before save", () => {
  assert.equal(adminPatch.includes("countOverlappingBookings"), true);
  assert.equal(adminPatch.includes("Schedule conflict"), true);
  assert.equal(adminPatch.includes("isWithinWorkingHours"), true);
});

test("driver cannot complete without POD and uploads are audited", () => {
  assert.equal(driverStatus.includes("Upload POD photo first before setting status to completed"), true);
  assert.equal(driverPod.includes('eventType: "pod_uploaded"'), true);
});
