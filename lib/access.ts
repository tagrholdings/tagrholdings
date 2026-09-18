import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

// No hardcoded fallback: a known default secret would let anyone mint valid
// portal tokens. Read per call (not at import) so a missing secret affects
// only the requests that need it, not the build.
function sign(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest();
}

export function createAccessToken(email: string) {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error("ACCESS_TOKEN_SECRET is not set.");
  }

  const payload = {
    email,
    issuedAt: Date.now(),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret).toString("hex")}`;
}

export function verifyAccessToken(token: string) {
  if (!token) return false;

  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    // Fail closed: the portal shows its request form instead of a 500.
    console.error("ACCESS_TOKEN_SECRET is not set — rejecting every portal token.");
    return false;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;

  // timingSafeEqual only *throws* on a length mismatch — for equal lengths it
  // returns a boolean that must be checked, or any 64-char signature passes.
  const received = Buffer.from(signature, "hex");
  const expected = sign(encodedPayload, secret);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!payload?.email || !payload?.issuedAt) return false;
    const age = Date.now() - Number(payload.issuedAt);
    return age >= 0 && age <= TOKEN_TTL_MS;
  } catch {
    return false;
  }
}
