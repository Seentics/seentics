import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SessionList } from '@/components/replays/SessionList';
import { sessionIcon, sessionLevel, sessionTags } from '@/features/replays/session-line';
import type { SessionRow } from '@/features/replays/list-types';

const session = (over: Partial<SessionRow>): SessionRow => ({
  id: 's1', session_id: 's1', country: 'United States', browser: 'Chrome', os: 'macOS', device: 'Desktop',
  entry_page: '/pricing', duration_seconds: 95, pages_viewed: 3, has_errors: false, has_rage_clicks: false,
  start_time: new Date().toISOString(), frustration_score: null, signal_counts: null, summary: null, ...over,
});

const rows = [
  session({ session_id: 'calm', frustration_score: 2, summary: 'Read the pricing page' }),
  session({ session_id: 'bad', has_errors: true, summary: 'Hit a checkout error' }),
];

describe('SessionList', () => {
  it('groups the sessions, the ones needing a look first, and folds a group', () => {
    render(<SessionList rows={rows} websiteId="w1" grouped onPlay={vi.fn()} />);
    const groups = screen.getAllByRole('region').map((g) => g.getAttribute('aria-label'));
    expect(groups).toEqual(['Needs a look', 'Smooth']);
    fireEvent.click(screen.getByRole('button', { name: /Needs a look/ }));
    expect(screen.queryByText('Hit a checkout error')).toBeNull();
    expect(screen.getByText('Read the pricing page')).toBeTruthy();
  });

  it('plays a session from its row or its button, and deletes only when allowed', () => {
    const onPlay = vi.fn();
    const onDelete = vi.fn();
    const { rerender } = render(<SessionList rows={rows} websiteId="w1" grouped={false} onPlay={onPlay} />);
    expect(screen.queryByTitle('Delete session')).toBeNull();
    fireEvent.click(screen.getByText('Hit a checkout error'));
    expect(onPlay).toHaveBeenCalledWith('bad');

    rerender(<SessionList rows={rows} websiteId="w1" grouped={false} onPlay={onPlay} onDelete={onDelete} />);
    const row = screen.getByText('Read the pricing page').closest('li')!;
    fireEvent.click(within(row).getByTitle('Delete session'));
    expect(onDelete).toHaveBeenCalledWith('calm');
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});

describe('session-line', () => {
  it('lists analysed signals most severe first, and the ingest flags before analysis', () => {
    expect(sessionTags({ signal_counts: { dead_click: 2, rage_click: 1 }, has_errors: false, has_rage_clicks: true }).map(t => t.label))
      .toEqual(['Rage clicks', 'Dead clicks']);
    expect(sessionTags({ signal_counts: null, has_errors: true, has_rage_clicks: true }).map(t => t.label)).toEqual(['JS error', 'Rage clicks']);
    expect(sessionTags({ signal_counts: null, has_errors: false, has_rage_clicks: false })).toEqual([]);
  });

  it('levels and icons follow what went wrong', () => {
    expect(sessionLevel({ has_errors: true, has_rage_clicks: false, frustration_score: null })).toBe('look');
    expect(sessionLevel({ has_errors: false, has_rage_clicks: false, frustration_score: 3 })).toBe('smooth');
    expect(sessionLevel({ has_errors: false, has_rage_clicks: false, frustration_score: null })).toBe('watch');
    expect(sessionIcon({ signal_counts: null, has_errors: true, has_rage_clicks: false, frustration_score: null }).kind).toBe('urgent');
    expect(sessionIcon({ signal_counts: null, has_errors: false, has_rage_clicks: true, frustration_score: null })).toEqual({ kind: 'bars', tone: 'orange' });
    expect(sessionIcon({ signal_counts: null, has_errors: false, has_rage_clicks: false, frustration_score: 2 }).kind).toBe('calm');
  });
});
