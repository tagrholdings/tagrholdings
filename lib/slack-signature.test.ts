import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySlackSignature } from "./slack-signature";

const SECRET = "shh";
const NOW = new Date("2026-10-22T12:00:00Z");
const ts = String(Math.floor(NOW.getTime() / 1000));
const sign = (body: string, timestamp = ts, secret = SECRET) => `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`;

describe("verifySlackSignature", () => {
  it("accepts a correctly signed, recent request", () => {
    expect(verifySlackSignature("{}", ts, sign("{}"), SECRET, NOW)).toBe(true);
  });

  it("rejects a body that changed after signing", () => {
    expect(verifySlackSignature('{"a":1}', ts, sign("{}"), SECRET, NOW)).toBe(false);
  });

  it("rejects a signature made with another secret", () => {
    expect(verifySlackSignature("{}", ts, sign("{}", ts, "other"), SECRET, NOW)).toBe(false);
  });

  it("rejects a replay older than five minutes", () => {
    const old = String(Math.floor(NOW.getTime() / 1000) - 6 * 60);
    expect(verifySlackSignature("{}", old, sign("{}", old), SECRET, NOW)).toBe(false);
  });

  it("rejects missing headers, a garbage timestamp and a wrong-length signature", () => {
    expect(verifySlackSignature("{}", null, sign("{}"), SECRET, NOW)).toBe(false);
    expect(verifySlackSignature("{}", ts, null, SECRET, NOW)).toBe(false);
    expect(verifySlackSignature("{}", "soon", sign("{}"), SECRET, NOW)).toBe(false);
    expect(verifySlackSignature("{}", ts, "v0=abc", SECRET, NOW)).toBe(false);
  });
});
