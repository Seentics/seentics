import { randomBytes } from "node:crypto";

/** Hex string of `byteLen` random bytes (e.g. 12 → 24 hex chars). */
export function randomHex(byteLen: number): string {
  return randomBytes(byteLen).toString("hex");
}

export function newSiteId(): string {
  return randomHex(12);
}

export function newTrackingId(): string {
  return `ST-${randomHex(8)}`;
}

export function newVerificationToken(): string {
  return randomHex(16);
}
