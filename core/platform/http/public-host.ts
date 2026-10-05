import dns from "node:dns";
import net from "node:net";

/**
 * Whether a hostname leads somewhere on the public internet.
 *
 * The webhook URL check looks at the text of the address, which cannot tell
 * `hooks.example.com` from a name its owner pointed at 127.0.0.1 or at the cloud metadata
 * service. This resolves the name and refuses it if any answer is a private, loopback,
 * link-local or otherwise reserved address. A name that does not resolve is refused too.
 *
 * Subnets are matched with a BlockList, which parses the address first: `::ffff:7f00:1` and
 * `0:0:0:0:0:0:0:1` are loopback in spellings a string prefix test would miss.
 */
const blocked = new net.BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) blocked.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32],
  ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(network, prefix, "ipv6");

export class NonPublicHostError extends Error {
  constructor(host: string) {
    super(`host resolves to a non-public address: ${host}`);
    this.name = "NonPublicHostError";
  }
}

export type Lookup = (host: string) => Promise<string[]>;

const defaultLookup: Lookup = async (host) =>
  (await dns.promises.lookup(host, { all: true, verbatim: true })).map((r) => r.address);

export function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 0) return true; // unparseable: deny by default
  // An IPv4 address inside an IPv6 wrapper is judged as the IPv4 address it is.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) return blocked.check(mapped[1]!, "ipv4");
  return blocked.check(ip, family === 4 ? "ipv4" : "ipv6");
}

export async function assertPublicHost(hostname: string, lookup: Lookup = defaultLookup): Promise<void> {
  const host = hostname.trim().toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (!host) throw new NonPublicHostError(host);

  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new NonPublicHostError(host);
    return;
  }

  let addresses: string[];
  try {
    addresses = await lookup(host);
  } catch {
    throw new NonPublicHostError(host);
  }
  if (addresses.length === 0 || addresses.some(isBlockedIp)) throw new NonPublicHostError(host);
}
