import type { ValueFormat } from './types';

/** Renders a cell or metric according to the format its tool declared. */
export function formatValue(value: unknown, format?: ValueFormat): string {
  if (value == null || value === '') return '—';
  if (typeof value !== 'number') return String(value);

  switch (format) {
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    case 'duration': {
      const m = Math.floor(value / 60);
      const s = Math.round(value % 60);
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
    }
    case 'currency':
      return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    default:
      return value.toLocaleString();
  }
}

/** A signed percentage for a period-over-period delta. */
export function formatDelta(delta: number): string {
  const pct = (delta * 100).toFixed(1);
  return `${delta >= 0 ? '+' : ''}${pct}%`;
}

/** Sub-cent costs are the common case, so two decimals would show every message as $0.00. */
export function formatCostUsd(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
