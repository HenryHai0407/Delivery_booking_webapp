import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const healthRoute = fs.readFileSync("src/app/api/health/route.ts", "utf8");
const envValidator = fs.readFileSync("scripts/validate-env.mjs", "utf8");

test("package scripts include deploy hardening checks", () => {
  assert.equal(typeof packageJson.scripts["check:env"], "string");
  assert.equal(typeof packageJson.scripts["deploy:check"], "string");
});

test("health endpoint includes db ping and readiness status", () => {
  assert.equal(healthRoute.includes("SELECT 1"), true);
  assert.equal(healthRoute.includes("status: ok ? 200 : 503"), true);
});

test("env validation script checks core runtime env", () => {
  assert.equal(envValidator.includes("DATABASE_URL"), true);
  assert.equal(envValidator.includes("NEXTAUTH_SECRET"), true);
  assert.equal(envValidator.includes("STORAGE_PROVIDER"), true);
});

