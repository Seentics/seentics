import { describe, expect, it } from "bun:test";
import {
  CHANNEL_CASE_SQL,
  channelCaseSql,
  SEARCH_HOST_PATTERN,
  SOCIAL_HOST_PATTERN,
  classifyTrafficChannel,
} from "../lib/traffic-channel";

/**
 * The channel is now decided once at ingest by `classifyTrafficChannel`, where it used to
 * be decided on every read by SQL. These pin the rules the SQL always had — precedence
 * and case sensitivity included — so events stored before and after the move classify
 * the same way.
 */

const PAGE = "https://shop.example.com/pricing";
const c = (referrer: string | null, utmSource: string | null = null, utmMedium: string | null = null, page = PAGE) =>
  classifyTrafficChannel({ referrer, page, utmSource, utmMedium });

describe("classifyTrafficChannel", () => {
  it("puts paid ahead of everything, case-insensitively and by prefix", () => {
    expect(c("https://facebook.com/", "facebook", "CPC")).toBe("paid");
    expect(c(null, null, "paid_newsletter")).toBe("paid");
  });

  it("matches email exactly — the SQL comparison is case-sensitive", () => {
    expect(c(null, "email")).toBe("email");
    expect(c(null, null, "email")).toBe("email");
    expect(c(null, null, "Email")).toBe("direct");
  });

  it("recognises social by medium, known source, or referrer host", () => {
    expect(c(null, null, "social")).toBe("social");
    expect(c(null, "linkedin")).toBe("social");
    expect(c("https://www.facebook.com/share")).toBe("social");
    expect(c("https://t.co/abc")).toBe("social");
  });

  it("anchors hosts: x.com is social, wix.com is not; a google path segment is not search", () => {
    expect(c("https://x.com/post")).toBe("social");
    expect(c("https://wix.com/x")).toBe("referral");
    expect(c("https://www.google.com/search?q=a")).toBe("organic");
    expect(c("https://example.com/google/thing")).toBe("referral");
  });

  it("falls back to campaign, then referral, then direct", () => {
    expect(c(null, "newsletter-42")).toBe("campaign");
    expect(c("https://news.ycombinator.com/")).toBe("referral");
    expect(c(null)).toBe("direct");
    expect(c("   ")).toBe("direct");
  });
});

describe("internal navigation", () => {
  it("marks a referrer on the page's own host as internal, not referral", () => {
    expect(c("https://shop.example.com/")).toBe("internal");
    expect(c("https://www.shop.example.com/docs")).toBe("internal");
    expect(c("http://SHOP.example.com")).toBe("internal");
  });

  it("keeps other hosts — including sibling subdomains — as referral", () => {
    expect(c("https://blog.example.com/post")).toBe("referral");
    expect(c("https://example.com/")).toBe("referral");
  });

  it("lets UTM tags on an in-site link win, as campaign links should", () => {
    expect(c("https://shop.example.com/", "banner")).toBe("campaign");
    expect(c("https://shop.example.com/", null, "cpc")).toBe("paid");
  });

  it("never calls a referrer internal when the page URL is missing or unparseable", () => {
    expect(c("https://shop.example.com/", null, null, "")).toBe("referral");
    expect(c("https://shop.example.com/", null, null, "/pricing")).toBe("referral");
  });
});

describe("CHANNEL_CASE_SQL", () => {
  it("is built from the same host patterns the classifier uses", () => {
    expect(CHANNEL_CASE_SQL).toContain(`'${SOCIAL_HOST_PATTERN}'`);
    expect(CHANNEL_CASE_SQL).toContain(`'${SEARCH_HOST_PATTERN}'`);
  });

  it("qualifies every column when given an alias, so it is safe inside a join", () => {
    const sql = channelCaseSql("ae");
    for (const col of ["utm_medium", "utm_source", "referrer", "page"]) {
      expect(sql.match(new RegExp(`(?<![.\\w])${col}\\b`, "g"))).toBeNull();
    }
  });

  it("has the internal rule between campaign and referral, like the classifier", () => {
    const at = (s: string) => CHANNEL_CASE_SQL.indexOf(s);
    expect(at("THEN 'campaign'")).toBeLessThan(at("THEN 'internal'"));
    expect(at("THEN 'internal'")).toBeLessThan(at("THEN 'referral'"));
  });
});
