import type { Context, Next } from "hono";

const ALLOWED_HEADERS =
  "Content-Type, Content-Length, Accept-Encoding, Content-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-API-Key, X-Site-ID";
const ALLOWED_METHODS = "POST, OPTIONS, GET, PUT, DELETE, PATCH";

function isProduction(): boolean {
  return process.env.ENVIRONMENT?.toLowerCase() === "production";
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const h = new URL(origin).hostname;
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Tracker routes (/api/v1/tracker/*) are embedded on any customer website, so
 * they must accept requests from any origin. Each route handler already validates
 * the origin against the registered website URL via validateOriginDomain().
 */
function isTrackerPath(path: string): boolean {
  return /^\/api\/v1\/tracker(\/|$)/.test(path);
}

/** Mirrors Go `middleware.CORSMiddleware` for tracker + dashboard API calls from browsers. */
export function corsMiddleware(allowedOriginsRaw: string) {
  const origins = allowedOriginsRaw.split(",").map((s) => s.trim());

  return async (c: Context, next: Next) => {
    const origin = c.req.header("Origin") ?? "";
    const path   = new URL(c.req.url).pathname;

    // Tracker endpoints are public — allow any origin. Auth is API-key based (X-API-Key),
    // not cookie-based, so credentials: true is not needed and would be a security risk.
    if (isTrackerPath(path)) {
      c.header("Access-Control-Allow-Origin", "*");
      c.header("Access-Control-Allow-Headers", ALLOWED_HEADERS);
      c.header("Access-Control-Allow-Methods", ALLOWED_METHODS);
      if (c.req.method === "OPTIONS") return c.body(null, 204);
      return next();
    }

    // Dashboard / API routes — restrict to configured allowed origins
    let allowThisOrigin = false;

    if (allowedOriginsRaw === "*" || allowedOriginsRaw === "") {
      allowThisOrigin = true;
    } else if (origin && isLocalhostOrigin(origin) && !isProduction()) {
      allowThisOrigin = true;
    } else {
      for (const o of origins) {
        if (o === origin) {
          allowThisOrigin = true;
          break;
        }
      }
    }

    if (allowThisOrigin && origin !== "") {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Credentials", "true");
      c.header("Vary", "Origin");
    } else if (allowedOriginsRaw === "*" || allowedOriginsRaw === "") {
      c.header("Access-Control-Allow-Origin", "*");
    }

    c.header("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    c.header("Access-Control-Allow-Methods", ALLOWED_METHODS);

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }

    return next();
  };
}
