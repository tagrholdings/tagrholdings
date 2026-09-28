import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "./notifications.types";

describe("isAllowedPushEndpoint", () => {
  it("accepts the real browser push services", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=abc")).toBe(true);
  });

  it("rejects anything else — the server would POST to it", () => {
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false); // not https
    expect(isAllowedPushEndpoint("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedPushEndpoint("https://localhost:3000/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false); // suffix trick
    expect(isAllowedPushEndpoint("https://evilfcm.googleapis.com.example/x")).toBe(false);
    expect(isAllowedPushEndpoint("not a url")).toBe(false);
  });
});
