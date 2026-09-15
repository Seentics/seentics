import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/** Reject addresses that a customer page must never make the capture browser reach. */
export function isPrivateOrReservedAddress(raw: string): boolean {
  const ip = raw.toLowerCase().replace(/^\[|\]$/g, "");
  if (ip.startsWith("::ffff:")) return isPrivateOrReservedAddress(ip.slice(7));
  if (isIP(ip) === 4) {
    const p = ip.split(".").map(Number);
    const [a, b] = p;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (isIP(ip) === 6) {
    return ip === "::" || ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") ||
      /^fe[89ab]/.test(ip);
  }
  return true;
}

/** Resolve immediately before use and reject if any answer is private/link-local. */
export async function hostnameResolvesPublicly(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return false;
  }
  if (isIP(host)) return !isPrivateOrReservedAddress(host);
  try {
    const answers = await lookup(host, { all: true, verbatim: true });
    return answers.length > 0 && answers.every((a) => !isPrivateOrReservedAddress(a.address));
  } catch {
    return false;
  }
}
