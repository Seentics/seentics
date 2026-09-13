/** Match Go: internal/shared/storage/s3.go */
export function sessionPrefix(websiteId: string, sessionId: string): string {
  return `sessions/${websiteId}/${sessionId}/`;
}

export function sessionBundleKey(websiteId: string, sessionId: string): string {
  return `sessions/${websiteId}/${sessionId}/bundle.json.gz`;
}

/** Immutable gzip chunk (sequence padded for lexical sort under ListObjects). */
export function sessionChunkKey(websiteId: string, sessionId: string, sequence: number): string {
  const seq = Number.isFinite(sequence) && sequence >= 0 ? Math.floor(sequence) : 0;
  const padded = seq.toString().padStart(8, "0");
  return `sessions/${websiteId}/${sessionId}/chunk-${padded}.json.gz`;
}
