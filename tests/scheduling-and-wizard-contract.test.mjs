import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const availabilityRoute = fs.readFileSync("src/app/api/public/availability/route.ts", "utf8");
const bookingWizard = fs.readFileSync("src/components/booking/booking-wizard.tsx", "utf8");
const dynamicApiFiles = [
  "src/app/api/admin/bookings/[id]/assign/route.ts",
  "src/app/api/admin/bookings/[id]/status/route.ts",
  "src/app/api/admin/bookings/[id]/route.ts",
  "src/app/api/admin/bookings/[id]/events/route.ts",
  "src/app/api/admin/bookings/[id]/resend/route.ts",
  "src/app/api/driver/jobs/[id]/status/route.ts",
  "src/app/api/driver/jobs/[id]/pod/route.ts",
  "src/app/api/bookings/[publicId]/route.ts"
];

test("availability api uses centralized overlap and working-hour checks", () => {
  assert.equal(availabilityRoute.includes("countOverlappingBookings"), true);
  assert.equal(availabilityRoute.includes("isWithinWorkingHours"), true);
  assert.equal(availabilityRoute.includes("Outside working hours"), true);
});

test("booking wizard submit includes staffRequired and planned window end", () => {
  assert.equal(bookingWizard.includes('formData.set("staffRequired"'), true);
  assert.equal(bookingWizard.includes('formData.set("requestedWindowEnd"'), true);
  assert.equal(bookingWizard.includes("applyDurationToLocalDateTime"), true);
});

test("dynamic api routes use Next.js async params typing", () => {
  for (const file of dynamicApiFiles) {
    const content = fs.readFileSync(file, "utf8");
    assert.equal(content.includes("params: Promise<"), true, `${file} should use Promise params typing`);
  }
});
