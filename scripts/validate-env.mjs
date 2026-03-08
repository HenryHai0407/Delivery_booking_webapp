import process from "node:process";

function has(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function pushIfMissing(keys, errors) {
  for (const key of keys) {
    if (!has(process.env[key])) errors.push(`Missing ${key}`);
  }
}

const errors = [];
const warnings = [];

pushIfMissing(["DATABASE_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET"], errors);

if (has(process.env.NEXTAUTH_SECRET) && process.env.NEXTAUTH_SECRET.length < 16) {
  errors.push("NEXTAUTH_SECRET must be at least 16 characters");
}

const strict = process.env.DEPLOYMENT_STRICT_ENV === "true";
const provider = (process.env.STORAGE_PROVIDER || "r2").toLowerCase();

if (provider !== "r2" && provider !== "supabase") {
  errors.push("STORAGE_PROVIDER must be 'r2' or 'supabase'");
}

if (provider === "r2") {
  const missing = ["STORAGE_BUCKET", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"].filter(
    (k) => !has(process.env[k])
  );
  if (missing.length > 0) {
    const message = `Missing R2 config: ${missing.join(", ")}`;
    if (strict) errors.push(message);
    else warnings.push(message);
  }
}

if (provider === "supabase") {
  const missing = ["STORAGE_BUCKET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !has(process.env[k]));
  if (missing.length > 0) {
    const message = `Missing Supabase config: ${missing.join(", ")}`;
    if (strict) errors.push(message);
    else warnings.push(message);
  }
}

const sendgridAny = has(process.env.SENDGRID_API_KEY) || has(process.env.SENDGRID_FROM_EMAIL);
if (sendgridAny) {
  const missing = ["SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL"].filter((k) => !has(process.env[k]));
  if (missing.length > 0) {
    const message = `Incomplete SendGrid config: ${missing.join(", ")}`;
    if (strict) errors.push(message);
    else warnings.push(message);
  }
} else if (strict) {
  errors.push("SendGrid required in strict mode");
}

if (warnings.length > 0) {
  console.warn("Env warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length > 0) {
  console.error("Env validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Env validation passed.");
