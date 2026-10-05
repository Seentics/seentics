import { describe, expect, it } from "bun:test";
import { assertPublicHost, isBlockedIp, NonPublicHostError } from "../public-host";

const resolvesTo = (...ips: string[]) => async () => ips;

describe("assertPublicHost", () => {
  it("accepts a name that resolves only to public addresses", async () => {
    await expect(assertPublicHost("hooks.example.com", resolvesTo("93.184.216.34", "2606:2800:220:1::1"))).resolves.toBeUndefined();
  });

  it("refuses a public-looking name that resolves to an internal address", async () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.5", "192.168.0.9", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      await expect(assertPublicHost("looks-public.example.com", resolvesTo(ip))).rejects.toBeInstanceOf(NonPublicHostError);
    }
  });

  it("refuses a name when any one of its answers is internal", async () => {
    await expect(assertPublicHost("mixed.example.com", resolvesTo("93.184.216.34", "10.0.0.1"))).rejects.toBeInstanceOf(NonPublicHostError);
  });

  it("refuses a name that does not resolve, or resolves to nothing", async () => {
    await expect(assertPublicHost("nope.example.com", async () => { throw new Error("ENOTFOUND"); })).rejects.toBeInstanceOf(NonPublicHostError);
    await expect(assertPublicHost("empty.example.com", resolvesTo())).rejects.toBeInstanceOf(NonPublicHostError);
  });

  it("judges IP literals directly, in any spelling, without asking DNS", async () => {
    const neverAsked = async () => { throw new Error("should not resolve"); };
    await expect(assertPublicHost("127.0.0.1", neverAsked)).rejects.toBeInstanceOf(NonPublicHostError);
    await expect(assertPublicHost("[::1]", neverAsked)).rejects.toBeInstanceOf(NonPublicHostError);
    await expect(assertPublicHost("0:0:0:0:0:0:0:1", neverAsked)).rejects.toBeInstanceOf(NonPublicHostError);
    await expect(assertPublicHost("93.184.216.34", neverAsked)).resolves.toBeUndefined();
  });

  it("denies what it cannot parse", () => {
    expect(isBlockedIp("not-an-ip")).toBe(true);
  });
});
