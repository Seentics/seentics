import type { AppConfig } from "../../config";
import { runDataRetentionCleanupSafe } from "./cleanup";

type BunCron = { cron?: (schedule: string, handler: () => void | Promise<void>) => { stop?: () => void } };

export function startDataRetentionCron(cfg: AppConfig): void {
  if (!cfg.dataRetention.enabled) return;
  const BunRef = (globalThis as { Bun?: BunCron }).Bun;
  if (!BunRef?.cron) {
    console.warn(
      "data retention: Bun.cron unavailable; schedule external calls to POST /api/v1/internal/retention-cleanup",
    );
    return;
  }
  BunRef.cron(cfg.dataRetention.cronExpression, () => {
    void runDataRetentionCleanupSafe(cfg).catch(() => {});
  });
  console.info("data retention cron registered", cfg.dataRetention.cronExpression);
}
