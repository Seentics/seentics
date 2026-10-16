import { describe, expect, it } from "bun:test";
import { isCrawlerNetwork } from "../crawler-network";

describe("isCrawlerNetwork", () => {
  it("knows Meta's link checker by the network it comes from", () => {
    // The address the Facebook-post "visitor" on 16 Oct came from.
    expect(isCrawlerNetwork("2a03:2880:31ff:23::")).toBe(true);
    expect(isCrawlerNetwork("[2a03:2880:f12f:83::face:b00c]")).toBe(true);
    expect(isCrawlerNetwork("173.252.127.10")).toBe(true);
    expect(isCrawlerNetwork("::ffff:69.171.230.1")).toBe(true);
  });

  it("leaves people alone, including Facebook app users on their own connection", () => {
    for (const ip of ["8.8.8.8", "203.0.113.9", "118.179.89.73", "2001:db8::1", "2a03:2881::1", "173.253.0.1"]) {
      expect([ip, isCrawlerNetwork(ip)]).toEqual([ip, false]);
    }
    expect(isCrawlerNetwork("")).toBe(false);
    expect(isCrawlerNetwork(undefined)).toBe(false);
    expect(isCrawlerNetwork("not an ip")).toBe(false);
  });
});
