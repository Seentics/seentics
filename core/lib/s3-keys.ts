/** Match Go: internal/shared/storage/s3.go */
export function sessionPrefix(websiteId: string, sessionId: string): string {
  return `sessions/${websiteId}/${sessionId}/`;
}

export function sessionBundleKey(websiteId: string, sessionId: string): string {
  return `sessions/${websiteId}/${sessionId}/bundle.json.gz`;
}
