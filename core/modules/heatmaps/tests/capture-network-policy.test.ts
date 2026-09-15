import { describe, expect, it } from "bun:test";
import { isPrivateOrReservedAddress } from "../lib/capture-network-policy";

describe("capture network policy", () => {
  it("blocks loopback, RFC1918, link-local, carrier NAT and IPv6 local ranges", () => {
    for (const ip of [
      "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1",
      "169.254.169.254", "100.64.0.1", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1",
    ]) expect(isPrivateOrReservedAddress(ip)).toBe(true);
  });

  it("allows ordinary public addresses", () => {
    expect(isPrivateOrReservedAddress("1.1.1.1")).toBe(false);
    expect(isPrivateOrReservedAddress("2606:4700:4700::1111")).toBe(false);
  });
});
