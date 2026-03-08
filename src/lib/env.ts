import { z } from "zod";

const baseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(16),
  STORAGE_PROVIDER: z.enum(["r2", "supabase"]).default("r2"),
  STORAGE_BUCKET: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_REGION: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().optional(),
  DEPLOYMENT_STRICT_ENV: z.string().optional()
});

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateEnv(options?: { strictIntegrations?: boolean }) {
  const parsed = baseEnvSchema.safeParse(process.env);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
    return { ok: false, errors, warnings };
  }

  const env = parsed.data;
  const strictIntegrations = options?.strictIntegrations ?? env.DEPLOYMENT_STRICT_ENV === "true";

  if (env.STORAGE_PROVIDER === "r2") {
    const missing = ["STORAGE_BUCKET", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"].filter(
      (key) => !hasValue(env[key as keyof typeof env] as string | undefined)
    );
    if (missing.length > 0) {
      const message = `Missing R2 config: ${missing.join(", ")}`;
      if (strictIntegrations) errors.push(message);
      else warnings.push(message);
    }
  }

  if (env.STORAGE_PROVIDER === "supabase") {
    const missing = ["STORAGE_BUCKET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter(
      (key) => !hasValue(env[key as keyof typeof env] as string | undefined)
    );
    if (missing.length > 0) {
      const message = `Missing Supabase config: ${missing.join(", ")}`;
      if (strictIntegrations) errors.push(message);
      else warnings.push(message);
    }
  }

  const sendgridConfigured = hasValue(env.SENDGRID_API_KEY) || hasValue(env.SENDGRID_FROM_EMAIL);
  if (sendgridConfigured) {
    const missing = ["SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL"].filter(
      (key) => !hasValue(env[key as keyof typeof env] as string | undefined)
    );
    if (missing.length > 0) {
      const message = `Incomplete SendGrid config: ${missing.join(", ")}`;
      if (strictIntegrations) errors.push(message);
      else warnings.push(message);
    }
  } else if (strictIntegrations) {
    errors.push("SendGrid is required in strict mode: set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL");
  } else {
    warnings.push("SendGrid not configured; notification delivery will be skipped");
  }

  return { ok: errors.length === 0, errors, warnings };
}
