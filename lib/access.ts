import { createHmac, timingSafeEqual } from "node:crypto";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "tagr-dev-access-secret";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function createAccessToken(email: string) {
  const payload = {
    email,
    issuedAt: Date.now(),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", ACCESS_TOKEN_SECRET)
    .update(encodedPayload)
    .digest("hex");

  return `${encodedPayload}.${signature}`;
}

export function verifyAccessToken(token: string) {
  if (!token) return false;

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) return false;

  const expectedSignature = createHmac("sha256", ACCESS_TOKEN_SECRET)
    .update(encodedPayload)
    .digest("hex");

  try {
    timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!payload?.email || !payload?.issuedAt) return false;
    return Date.now() - Number(payload.issuedAt) <= TOKEN_TTL_MS;
  } catch {
    return false;
  }
}
