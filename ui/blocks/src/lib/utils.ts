export const fmt = {
  number: (n: number): string => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
  },
  percent: (n: number): string => `${n.toFixed(1)}%`,
  duration: (seconds: number): string => {
    if (seconds < 60)   return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  },
};

export const growth = (current: number, previous: number): number | null => {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

/** Clamp a value between min and max */
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const getPathFromUrl = (url: string): string => {
  try { return new URL(url).pathname; } catch { return url || '/'; }
};

export const getPageName = (url: string): string => {
  const path = getPathFromUrl(url);
  if (path === '/') return 'Homepage';
  const seg = path.split('/').filter(Boolean).pop() ?? path;
  return seg.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

// ─── Shared style tokens (matching the Seentics app design) ──────────────────
export const t = {
  // Colors
  primary:     '#2563eb',
  primaryLight:'#93c5fd',
  emerald:     '#10b981',
  rose:        '#ef4444',
  orange:      '#f59e0b',
  muted:       '#6b7280',
  border:      'rgba(0,0,0,0.08)',
  // Card
  card: {
    background: '#ffffff',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    border: '1px solid rgba(0,0,0,0.08)',
    overflow: 'hidden' as const,
  },
  // Text
  text:  { color: '#111827' },
  small: { fontSize: 12, color: '#6b7280' },
  tiny:  { fontSize: 11, color: '#6b7280' },
};
