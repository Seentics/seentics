import { createHash } from "node:crypto";

/**
 * The key a prize claim is stored under: sha256 of the normalised address, hex.
 *
 * Lets "one prize per email per popup" hold for as long as the popup lives without keeping the
 * address once its submission ages out. Not a secret — anyone who can guess an address can
 * compute its hash — but a claim row reveals nothing on its own.
 */
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}
