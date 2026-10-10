'use client';

import { RangeSelect } from '@/components/ui/range-select';

/**
 * The windows the recordings list offers. They are rolling windows measured back from
 * now, so "Last 24 hours" is one day of sessions rather than "today". 31 days is the
 * longest, matching how long raw data is kept.
 */
export const REPLAY_RANGES = [
  { days: 1, label: 'Last 24 hours' },
  { days: 7, label: 'Last 7 days' },
  { days: 31, label: 'Last 31 days' },
] as const;

export const DEFAULT_REPLAY_DAYS = 31;

export function ReplayRangeSelect({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return <RangeSelect value={value} onChange={onChange} ranges={REPLAY_RANGES} />;
}
