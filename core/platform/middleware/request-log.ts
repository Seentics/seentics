import type { MiddlewareHandler } from "hono";
import { getClientIp } from "../lib/client-ip";
import type { AppConfig } from "../../config";
import { log } from "../lib/logger";

export function requestLogMiddleware(cfg: Pick<AppConfig, "trustProxy" | "slowRequestThresholdMs">): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    const path = new URL(c.req.url).pathname;
    const ip = getClientIp(c, cfg.trustProxy);
    let err: unknown;
    try {
      await next();
    } catch (e) {
      err = e;
      throw e;
    } finally {
      const ms = Date.now() - start;
      const status = err ? (c.res?.status ?? 500) : (c.res?.status ?? 200);
      const fields = {
        msg: "http_request",
        method: c.req.method,
        path,
        status,
        ms,
        ip,
      };
      if (err || status >= 500) {
        log.error(err ? { ...fields, err: String(err) } : fields);
      } else if (status >= 400) {
        log.warn(fields);
      } else {
        log.info(fields);
      }
      const threshold = cfg.slowRequestThresholdMs;
      if (threshold > 0 && ms > threshold) {
        log.warn({
          msg:    "slow_request",
          method: c.req.method,
          path,
          status,
          ms,
          threshold,
        });
      }
    }
  };
}
