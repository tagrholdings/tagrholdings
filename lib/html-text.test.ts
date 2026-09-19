import { describe, expect, it } from "vitest";
import { decodeEntities, extractLinks, htmlToText } from "./html-text";

describe("htmlToText", () => {
  it("drops scripts, styles and comments, keeps block structure and link targets", () => {
    const html = `<html><head><title>x</title><style>p{color:red}</style></head><body>
      <!-- hidden -->
      <script>var secret = 1;</script>
      <h1>Cool Air &amp; Heating</h1>
      <p>Owner retiring.<br>Asking $850,000</p>
      <a href="https://bizlistings.test/listing/42?utm=1">View listing</a>
      <a href="mailto:x@y.test">Email</a>
    </body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("Cool Air & Heating");
    expect(text).toContain("Owner retiring.\nAsking $850,000");
    expect(text).toContain("View listing (https://bizlistings.test/listing/42?utm=1)");
    expect(text).toContain("Email");
    expect(text).not.toContain("secret");
    expect(text).not.toContain("hidden");
    expect(text).not.toContain("color:red");
  });

  it("caps the output", () => {
    expect(htmlToText(`<p>${"a".repeat(1000)}</p>`, 100)).toHaveLength(100);
  });
});

describe("decodeEntities", () => {
  it("decodes named and numeric entities and leaves unknown ones alone", () => {
    expect(decodeEntities("a &amp; b &lt;c&gt; &#39;q&#39; &#x41; &nbsp;z &bogus;")).toBe("a & b <c> 'q' A  z &bogus;");
  });
});

describe("extractLinks", () => {
  it("returns http(s) links with their visible text and skips others", () => {
    const html = '<a href="https://a.test/x?y=1&amp;z=2"><b>Confirm</b> now</a><a href="javascript:alert(1)">bad</a><a href="/relative">rel</a>';
    expect(extractLinks(html)).toEqual([{ href: "https://a.test/x?y=1&z=2", text: "Confirm now" }]);
  });
});
