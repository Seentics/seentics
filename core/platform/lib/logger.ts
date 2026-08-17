import type { AppConfig } from "../../config";

export type LogLevel = "debug" | "info" | "warn" | "error";
type Level = LogLevel;

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let minLevel: Level = "info";

export function configureLogger(cfg: AppConfig): void {
  const raw = (cfg.logLevel ?? "info").toLowerCase() as Level;
  minLevel = order[raw] != null ? raw : "info";
}

function shouldLog(level: Level): boolean {
  return order[level] >= order[minLevel];
}

function emit(level: Level, fields: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    service: "seentics-core",
    ...fields,
  };
  const text = JSON.stringify(line);
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

type LogFields = Record<string, unknown>;

export interface Logger {
  debug(fields: LogFields): void;
  info(fields: LogFields): void;
  warn(fields: LogFields): void;
  error(fields: LogFields): void;
  /** Returns a scoped logger that merges `defaults` into every log line. */
  child(defaults: LogFields): Logger;
}

export const log: Logger = {
  debug(fields) { emit("debug", fields); },
  info(fields) { emit("info", fields); },
  warn(fields) { emit("warn", fields); },
  error(fields) { emit("error", fields); },
  child(defaults) {
    return {
      debug(fields) { emit("debug", { ...defaults, ...fields }); },
      info(fields)  { emit("info",  { ...defaults, ...fields }); },
      warn(fields)  { emit("warn",  { ...defaults, ...fields }); },
      error(fields) { emit("error", { ...defaults, ...fields }); },
      child(more)   { return log.child({ ...defaults, ...more }); },
    };
  },
};
