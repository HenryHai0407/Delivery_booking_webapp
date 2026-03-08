import { createHmac, createHash } from "crypto";

type PresignInput = {
  bookingId: string;
  filename: string;
  expiresInSeconds?: number;
};

export type PresignOutput = {
  key: string;
  method: "PUT";
  uploadUrl: string;
  storageUrl: string;
  expiresInSeconds: number;
  provider: "r2" | "supabase";
};

function hex(buffer: Buffer) {
  return buffer.toString("hex");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function isoDateParts(now = new Date()) {
  const iso = now.toISOString().replace(/[-:]/g, "");
  return {
    amzDate: `${iso.slice(0, 8)}T${iso.slice(9, 15)}Z`,
    shortDate: iso.slice(0, 8)
  };
}

function encodePathSegment(segment: string) {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildObjectKey(bookingId: string, filename: string) {
  return `pod/${bookingId}/${Date.now()}-${sanitizeFilename(filename)}`;
}

function presignR2(input: PresignInput): PresignOutput {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.STORAGE_BUCKET;
  const region = process.env.R2_REGION || "auto";
  const expiresInSeconds = input.expiresInSeconds ?? 300;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Missing R2 config: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, STORAGE_BUCKET");
  }

  const key = buildObjectKey(input.bookingId, input.filename);
  const baseUrl = new URL(endpoint);
  const normalizedPathPrefix = baseUrl.pathname.replace(/\/$/, "");
  const objectPath = `${normalizedPathPrefix}/${encodePathSegment(bucket)}/${key.split("/").map(encodePathSegment).join("/")}`;
  const host = baseUrl.host;
  const { amzDate, shortDate } = isoDateParts();
  const credentialScope = `${shortDate}/${region}/s3/aws4_request`;

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host"
  };

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join("&");

  const canonicalRequest = ["PUT", objectPath, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256(canonicalRequest)].join("\n");

  const kDate = hmac(`AWS4${secretAccessKey}`, shortDate);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hex(hmac(kSigning, stringToSign));

  const signedQuery = `${canonicalQuery}&X-Amz-Signature=${signature}`;
  const uploadUrl = `${baseUrl.protocol}//${host}${objectPath}?${signedQuery}`;
  const storageUrl = `${baseUrl.protocol}//${host}${objectPath}`;

  return {
    key,
    method: "PUT",
    uploadUrl,
    storageUrl,
    expiresInSeconds,
    provider: "r2"
  };
}

async function presignSupabase(input: PresignInput): Promise<PresignOutput> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.STORAGE_BUCKET;
  const expiresInSeconds = input.expiresInSeconds ?? 300;
  if (!supabaseUrl || !serviceRoleKey || !bucket) {
    throw new Error("Missing Supabase config: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STORAGE_BUCKET");
  }

  const key = buildObjectKey(input.bookingId, input.filename);
  const signPath = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/upload/sign/${bucket}/${key}`;
  const response = await fetch(signPath, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds })
  });

  const payload = (await response.json()) as { signedURL?: string; token?: string; error?: string; message?: string };
  if (!response.ok || !payload.signedURL) {
    throw new Error(payload.message || payload.error || "Failed to create Supabase signed upload URL");
  }

  const uploadUrl = payload.signedURL.startsWith("http")
    ? payload.signedURL
    : `${supabaseUrl.replace(/\/$/, "")}/storage/v1${payload.signedURL}`;
  const storageUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${key}`;

  return {
    key,
    method: "PUT",
    uploadUrl,
    storageUrl,
    expiresInSeconds,
    provider: "supabase"
  };
}

export async function createSignedUpload(input: PresignInput): Promise<PresignOutput> {
  const provider = (process.env.STORAGE_PROVIDER || "r2").toLowerCase();
  if (provider === "r2") return presignR2(input);
  if (provider === "supabase") return presignSupabase(input);
  throw new Error("Unsupported STORAGE_PROVIDER. Use 'r2' or 'supabase'.");
}
