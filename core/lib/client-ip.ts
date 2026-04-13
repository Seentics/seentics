import type { Context } from "hono";

export function getClientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = c.req.header("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const xri = c.req.header("x-real-ip")?.trim();
    if (xri) return xri;
  }
  return "unknown";
}
