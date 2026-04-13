/** Match Go `websites.ValidateOriginDomain` / gateway edge validation. */
export function validateOriginDomain(
  origin: string,
  registeredURL: string,
  environment: string,
): boolean {
  if (!origin.trim()) return true;

  let originDomain: string;
  if (origin.includes("://")) {
    try {
      originDomain = new URL(origin).hostname;
    } catch {
      return false;
    }
  } else {
    originDomain = origin;
  }

  originDomain = originDomain.toLowerCase().replace(/^www\./, "");

  if (
    environment !== "production" &&
    (originDomain === "localhost" || originDomain === "127.0.0.1")
  ) {
    return true;
  }

  const siteHost = siteHostForOriginMatch(registeredURL);
  return originDomain === siteHost;
}

function siteHostForOriginMatch(registered: string): string {
  let s = registered.trim();
  if (s.includes("://")) {
    try {
      const u = new URL(s);
      if (u.hostname) return u.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      /* keep s */
    }
  }
  const hostPort = s.split("/")[0] ?? s;
  if (hostPort.includes(":") && !hostPort.startsWith("[")) {
    const i = hostPort.lastIndexOf(":");
    const host = hostPort.slice(0, i);
    return host.toLowerCase().replace(/^www\./, "");
  }
  return hostPort.toLowerCase().replace(/^www\./, "");
}

export function originFromRequest(h: Headers): string {
  return h.get("Origin")?.trim() || h.get("Referer")?.trim() || "";
}
