import { BlockList, isIPv4, isIPv6 } from "node:net";

/**
 * Whether a request comes from a network that only crawlers browse from.
 *
 * Most crawlers say what they are in their User-Agent (bot-user-agent.ts). Meta's link checker
 * does not: when a link is posted on Facebook, Instagram, Messenger or WhatsApp, Meta opens it
 * in what calls itself mobile Chrome, runs the page's scripts for half a minute and leaves. It
 * counted as a visitor from the US with a session and an empty replay, once for every post.
 *
 * It comes from Meta's own network (AS32934), which people do not browse from: the Facebook
 * app's built-in browser uses the phone's own connection, not Meta's. So an address in these
 * ranges is a crawler, whatever it claims to be.
 */
const RANGES: readonly [string, number][] = [
  // AS32934, Meta Platforms: the ranges its crawlers are seen from.
  ["2a03:2880::", 32],
  ["31.13.24.0", 21],
  ["31.13.64.0", 18],
  ["45.64.40.0", 22],
  ["66.220.144.0", 20],
  ["69.63.176.0", 20],
  ["69.171.224.0", 19],
  ["74.119.76.0", 22],
  ["102.132.96.0", 20],
  ["103.4.96.0", 22],
  ["129.134.0.0", 16],
  ["157.240.0.0", 16],
  ["163.70.128.0", 17],
  ["173.252.64.0", 18],
  ["179.60.192.0", 22],
  ["185.60.216.0", 22],
  ["185.89.216.0", 22],
  ["204.15.20.0", 22],
];

const crawlers = new BlockList();
for (const [address, prefix] of RANGES) crawlers.addSubnet(address, prefix, isIPv6(address) ? "ipv6" : "ipv4");

export function isCrawlerNetwork(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const address = ip.trim().replace(/^\[|\]$/g, "");
  // An IPv4 address carried in IPv6 form (::ffff:31.13.70.1) is matched as the IPv4 it is.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return crawlers.check(mapped, "ipv4");
  if (isIPv4(address)) return crawlers.check(address, "ipv4");
  if (isIPv6(address)) return crawlers.check(address, "ipv6");
  return false;
}
