/** Match Go: internal/shared/storage/s3.go */
export function sessionPrefix(websiteId: string, sessionId: string): string {
  return `sessions/${websiteId}/${sessionId}/`;
}

export function sessionBundleKey(websiteId: string, sessionId: string): string {
  return `sessions/${websiteId}/${sessionId}/bundle.json.gz`;
}

/** Immutable gzip chunk (sequence padded for lexical sort under ListObjects). */
export function sessionChunkKey(
  websiteId: string,
  sessionId: string,
  sequence: number,
  batchId?: string,
): string {
  const seq = Number.isFinite(sequence) && sequence >= 0 ? Math.floor(sequence) : 0;
  const padded = seq.toString().padStart(8, "0");
  const suffix = batchId && /^[a-f0-9]{32}$/i.test(batchId) ? `-${batchId.toLowerCase()}` : "";
  return `sessions/${websiteId}/${sessionId}/chunk-${padded}${suffix}.json.gz`;
}

/** Every archived replay stylesheet of one website — the prefix a site's erasure clears. */
export function stylesheetPrefix(websiteId: string): string {
  return `stylesheets/${websiteId}/`;
}

/** One archived stylesheet, content-addressed: identical files of a site share an object. */
export function stylesheetObjectKey(websiteId: string, contentSha256: string): string {
  return `stylesheets/${websiteId}/${contentSha256}.css`;
}
