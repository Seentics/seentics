/**
 * The only part of a secret the dashboard ever shows: its last four characters.
 *
 * Too-short secrets show nothing rather than most of themselves, and the result is a hint
 * to recognise a key by — not something that narrows a guess.
 */
export function lastChars(secret: string, n = 4): string {
  const s = secret.trim();
  return s.length >= n * 3 ? s.slice(-n) : "";
}

/**
 * Remove every secret from text before it is stored or logged.
 *
 * Provider error bodies can echo a request back. Credentials never go into a message on
 * purpose, but this makes "never" a property of the code rather than of the providers.
 */
export function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length >= 6) out = out.split(secret).join("[redacted]");
  }
  return out;
}
