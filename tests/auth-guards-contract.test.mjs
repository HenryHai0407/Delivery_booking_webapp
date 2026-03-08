import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const protectedRoutes = [
  "src/app/api/admin/bookings/route.ts",
  "src/app/api/admin/stats/route.ts",
  "src/app/api/admin/bookings/[id]/route.ts",
  "src/app/api/admin/bookings/[id]/assign/route.ts",
  "src/app/api/admin/bookings/[id]/events/route.ts",
  "src/app/api/admin/bookings/[id]/status/route.ts",
  "src/app/api/admin/bookings/[id]/resend/route.ts",
  "src/app/api/admin/settings/route.ts",
  "src/app/api/admin/schedule/check/route.ts",
  "src/app/api/driver/jobs/route.ts",
  "src/app/api/driver/jobs/[id]/status/route.ts",
  "src/app/api/driver/jobs/[id]/pod/route.ts",
  "src/app/api/uploads/presign/route.ts"
];

test("protected routes use requireRole guard", () => {
  for (const file of protectedRoutes) {
    const content = fs.readFileSync(file, "utf8");
    assert.equal(content.includes("requireRole("), true, `${file} should call requireRole(...)`);
  }
});
