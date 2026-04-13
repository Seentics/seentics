import type { Context, Next } from "hono";

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

/** Mirrors Go `middleware.CORSMiddleware` for tracker + dashboard API calls from browsers. */
export function corsMiddleware(allowedOriginsRaw: string) {
  const origins = allowedOriginsRaw.split(",").map((s) => s.trim());

  return async (c: Context, next: Next) => {
    const origin = c.req.header("Origin") ?? "";
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
    } else if (allowedOriginsRaw === "*" || allowedOriginsRaw === "") {
      c.header("Access-Control-Allow-Origin", "*");
    }

    c.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Content-Length, Accept-Encoding, Content-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-API-Key, X-Site-ID",
    );
    c.header("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH");

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }

    return next();
  };
}
