import type { AppConfig } from "../config";

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

export const log = {
  debug(fields: Record<string, unknown>) {
    emit("debug", fields);
  },
  info(fields: Record<string, unknown>) {
    emit("info", fields);
  },
  warn(fields: Record<string, unknown>) {
    emit("warn", fields);
  },
  error(fields: Record<string, unknown>) {
    emit("error", fields);
  },
};
