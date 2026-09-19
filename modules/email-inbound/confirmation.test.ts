import { describe, expect, it } from "vitest";
import { detectConfirmation, matchSource, registrableDomain, senderDomain, senderSiteUrl } from "./confirmation";

const email = (over: Partial<Parameters<typeof detectConfirmation>[0]> = {}) => ({
  from: "BizListings <no-reply@mail.bizlistings.test>",
  subject: "Please confirm your subscription",
  text: "Thanks for signing up! Click here to confirm: https://bizlistings.test/confirm?token=abc",
  html: null,
  ...over,
});

describe("detectConfirmation", () => {
  it("recognises a short confirmation email with exactly one confirm link (text body)", () => {
    expect(detectConfirmation(email())).toEqual({ link: "https://bizlistings.test/confirm?token=abc" });
  });

  it("recognises an HTML confirmation and reads the link from the button", () => {
    const html = '<p>Almost done!</p><a href="https://bizlistings.test/verify/xyz?a=1&amp;b=2">Confirm my email</a>';
    expect(detectConfirmation(email({ subject: "Verify your email", html, text: "" }))).toEqual({ link: "https://bizlistings.test/verify/xyz?a=1&b=2" });
  });

  it("ignores unsubscribe / preference links", () => {
    const html = '<a href="https://bizlistings.test/confirm/1">Confirm</a> <a href="https://bizlistings.test/unsubscribe/confirm">Unsubscribe</a>';
    expect(detectConfirmation(email({ html, text: "" }))).toEqual({ link: "https://bizlistings.test/confirm/1" });
  });

  it.each([
    ["the subject has no confirmation word", { subject: "Welcome to BizListings" }],
    ["it is a listing digest even though the subject says confirm", { subject: "Confirm: 5 new listings for sale near you" }],
    ["the body is long like a digest", { text: `Confirm your subscription https://b.test/confirm ${"Great HVAC business for sale. ".repeat(200)}` }],
    ["the body is empty", { text: "   " }],
    ["there is no confirm-looking link", { text: "Please confirm your subscription by replying to this email." }],
    ["there are two competing confirm links (can't tell which is real)", { text: "Confirm: https://b.test/confirm/1 or https://b.test/verify/2" }],
  ])("returns null when %s (bias: don't match when unsure)", (_label, over) => {
    expect(detectConfirmation(email(over as never))).toBeNull();
  });
});

describe("matchSource", () => {
  const sources = [
    { id: "biz", signupUrl: "https://www.bizlistings.test/newsletter" },
    { id: "other", signupUrl: "https://othersite.test/join" },
  ];

  it("matches the one source whose site is the sender's domain", () => {
    expect(matchSource(sources, email(), "https://bizlistings.test/confirm?token=abc")?.id).toBe("biz");
  });

  it("matches via the confirmation link's domain when the sender uses an email service provider", () => {
    const viaEsp = { from: "BizListings <bounce@esp-mail.test>" };
    expect(matchSource(sources, viaEsp, "https://www.bizlistings.test/confirm/abc")?.id).toBe("biz");
  });

  it("refuses when no listed site relates to the email", () => {
    expect(matchSource(sources, { from: "x@unknown.test" }, "https://unknown.test/confirm")).toBeNull();
  });

  it("refuses when the link points at an unrelated third-party domain (we would GET it)", () => {
    expect(matchSource(sources, email(), "https://evil.test/confirm?redirect=bizlistings.test")).toBeNull();
  });

  it("refuses to guess when more than one listed site matches", () => {
    const twins = [...sources, { id: "biz2", signupUrl: "https://bizlistings.test/other-form" }];
    expect(matchSource(twins, email(), "https://bizlistings.test/confirm")).toBeNull();
  });
});

describe("sender helpers", () => {
  it("finds the registrable domain, including two-part TLDs", () => {
    expect(registrableDomain("mail.bizlistings.test")).toBe("bizlistings.test");
    expect(registrableDomain("a.b.example.co.uk")).toBe("example.co.uk");
    expect(senderDomain('"Biz" <x@e.bizlistings.test>')).toBe("bizlistings.test");
  });

  it("makes a site URL from the sender, but not for free-mail senders", () => {
    expect(senderSiteUrl("News <news@bizbuysell.test>")).toBe("https://bizbuysell.test");
    expect(senderSiteUrl("Bob <bob@gmail.com>")).toBeNull();
    expect(senderSiteUrl("not an address")).toBeNull();
  });
});
