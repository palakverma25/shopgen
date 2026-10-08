import { describe, expect, it } from "vitest";
import { asStoreContent, stripHtml } from "../src/security/sanitize.js";
import { allowRequest, resetRateLimits } from "../src/security/ratelimit.js";

describe("store text sanitization", () => {
  it("strips HTML and wraps policy text as untrusted store content", () => {
    const html = "<p>We have a <strong>30-day</strong> return policy.<script>alert(1)</script></p>";
    const wrapped = asStoreContent(html);
    expect(wrapped).toContain("<store_content source=\"shopify\">");
    expect(wrapped).toContain("30-day");
    expect(wrapped).not.toContain("<script>");
    expect(wrapped).not.toContain("<strong>");
    expect(stripHtml(html)).toBe("We have a 30-day return policy.");
  });
});

describe("rate limit", () => {
  it("blocks a noisy key without throwing", () => {
    resetRateLimits();
    expect(allowRequest("test", 2, 60_000, 1)).toBe(true);
    expect(allowRequest("test", 2, 60_000, 2)).toBe(true);
    expect(allowRequest("test", 2, 60_000, 3)).toBe(false);
  });
});
