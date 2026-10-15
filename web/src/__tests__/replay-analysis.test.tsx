import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  FRUSTRATED_MIN_SCORE, formatOffset, frustrationTone, markerPercent, signalChips, signalLine, summaryNotice,
  type SessionAnalysis,
} from '@/features/replays/analysis';
import { replayListQuery } from '@/features/replays/api';
import { askAbout } from '@/features/ai/ask-link';
import { sessionColumns } from '@/components/replays/session-columns';

describe('analysis helpers', () => {
  it('lists signals most severe first, skipping zeros and unknowns', () => {
    expect(signalChips({ dead_click: 2, rage_click: 1, u_turn: 0 })).toEqual([
      { type: 'rage_click', count: 1, label: 'Rage clicks' },
      { type: 'dead_click', count: 2, label: 'Dead clicks' },
    ]);
    expect(signalChips(null)).toEqual([]);
  });

  it('maps scores to tones, with the Frustrated filter threshold as the medium boundary', () => {
    expect(frustrationTone(null)).toBe('none');
    expect(frustrationTone(0)).toBe('none');
    expect(frustrationTone(FRUSTRATED_MIN_SCORE - 1)).toBe('low');
    expect(frustrationTone(FRUSTRATED_MIN_SCORE)).toBe('medium');
    expect(frustrationTone(76)).toBe('high');
  });

  it('formats offsets as the player clock and places markers on the bar', () => {
    expect(formatOffset(65_400)).toBe('1:05');
    expect(formatOffset(3_725_000)).toBe('1:02:05');
    expect(markerPercent(500, 1000)).toBe(50);
    expect(markerPercent(5000, 1000)).toBe(100);
    expect(markerPercent(10, 0)).toBe(0);
  });

  it('explains a missing summary, and says nothing when there is one or AI is off', () => {
    expect(summaryNotice('ready')).toBeNull();
    expect(summaryNotice('unavailable')).toBeNull();
    expect(summaryNotice('cooldown', 125)).toContain('about 3 minutes');
    expect(summaryNotice('limit')).toContain("today's session summaries");
  });

  it('writes one line per signal', () => {
    expect(signalLine({ type: 'rage_click', atMs: 0, page: '/cart', label: 'button "Apply"', count: 5 })).toBe('button "Apply" ×5 · /cart');
    expect(signalLine({ type: 'u_turn', atMs: 0, page: '/checkout', detail: 'back to /pricing after 3s' })).toBe('back to /pricing after 3s · /checkout');
  });

  it('sends frustration filters to the server only when set', () => {
    expect(replayListQuery({})).toEqual({ limit: 20, offset: 0 });
    expect(replayListQuery({ minFrustration: 30, signal: 'dead_click', sort: 'frustration' })).toMatchObject({
      min_frustration: 30, signal: 'dead_click', sort: 'frustration',
    });
    expect(replayListQuery({ sort: 'recent', minFrustration: 400 })).toEqual({ limit: 20, offset: 0, min_frustration: 100 });
  });

  it('asks the assistant about the session by id', () => {
    expect(askAbout.session('sess_1').question).toContain('session sess_1');
  });
});

describe('session list columns', () => {
  const cols = sessionColumns({ websiteId: 'w1', onPlay: vi.fn(), onDelete: vi.fn() });
  const cell = (id: string, original: Record<string, unknown>) =>
    render(<div>{(cols.find(c => c.id === id) as any).cell({ row: { original } })}</div>);

  const base = { pages_viewed: 3, entry_page: '/pricing', has_errors: false, has_rage_clicks: false, frustration_score: null, summary: null };

  it('shows the one-line summary once analysed, on one line', () => {
    const { container } = cell('summary', { ...base, frustration_score: 76, summary: 'Rage-clicked button "Apply coupon" 4 times on /checkout' });
    expect(screen.getByText('Rage-clicked button "Apply coupon" 4 times on /checkout')).toBeTruthy();
    expect(container.querySelector('.truncate')).toBeTruthy();
    expect(container.querySelector('[title="Frustration score 76/100"]')).toBeTruthy();
  });

  it('falls back to the ingest flags for an unanalysed session', () => {
    cell('summary', { ...base, has_errors: true });
    expect(screen.getByText(/^Hit an error · 3 pages from/)).toBeTruthy();
  });

  it('says a calm analysed session had no friction', () => {
    cell('summary', { ...base, frustration_score: 0 });
    expect(screen.getByText(/no friction$/)).toBeTruthy();
  });
});

// ── the player panel ──────────────────────────────────────────────────────────

const aiStatus = { data: { configured: true } as { configured: boolean } | undefined, isLoading: false };
const getSessionAnalysis = vi.fn();

vi.mock('@/features/ai/queries', () => ({ useAiStatus: () => aiStatus }));
vi.mock('@/features/replays/analysis', async (orig) => ({
  ...(await orig<typeof import('@/features/replays/analysis')>()),
  getSessionAnalysis: (...args: unknown[]) => getSessionAnalysis(...args),
}));

const analysis: SessionAnalysis = {
  sessionId: 's1',
  status: 'ready',
  score: 76,
  counts: { rage_click: 1 },
  signals: [{ type: 'rage_click', atMs: 34_281, page: '/cart', label: 'button "Apply"', count: 5 }],
  timeline: { durationMs: 40_000, errorCount: 6, pages: [] },
  computedAt: '2026-10-13T10:00:00.000Z',
  summary: { text: 'The coupon button kept failing on /cart.', intent: 'Use a coupon', outcome: 'abandoned', moments: [{ atMs: 32_409, label: 'Apply throws' }] },
  summarySource: 'ai',
  summaryStatus: 'ready',
};

async function renderPanel(bridge: unknown = null) {
  const { SessionAnalysisPanel } = await import('@/components/replays/session-analysis-panel');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SessionAnalysisPanel websiteId="w1" sessionId="s1" replayBridge={bridge as never} />
    </QueryClientProvider>,
  );
}

describe('SessionAnalysisPanel', () => {
  beforeEach(() => {
    getSessionAnalysis.mockReset();
    aiStatus.data = { configured: true };
  });

  it('shows the AI summary, outcome and moments, and seeks the player from a moment', async () => {
    getSessionAnalysis.mockResolvedValue(analysis);
    const goto = vi.fn();
    await renderPanel({ durationMs: 40_000, player: { goto } });
    expect(await screen.findByText('The coupon button kept failing on /cart.')).toBeTruthy();
    expect(screen.getByText('Abandoned')).toBeTruthy();
    // The stored analysis already has its summary: one fast read, no second request for it.
    expect(getSessionAnalysis).toHaveBeenCalledWith('w1', 's1', false);
    expect(getSessionAnalysis).not.toHaveBeenCalledWith('w1', 's1', true);
    fireEvent.click(screen.getByText('0:32'));
    expect(goto).toHaveBeenCalledWith(32_409, false);
    expect(screen.getByLabelText('Ask AI about this')).toBeTruthy();
  });

  it('shows the signals first, then asks for the summary when there is none yet', async () => {
    getSessionAnalysis
      .mockResolvedValueOnce({ ...analysis, summary: null, summarySource: null, summaryStatus: 'not_requested' })
      .mockResolvedValueOnce(analysis);
    await renderPanel();
    expect(await screen.findByText('The coupon button kept failing on /cart.')).toBeTruthy();
    expect(getSessionAnalysis).toHaveBeenNthCalledWith(1, 'w1', 's1', false);
    expect(getSessionAnalysis).toHaveBeenNthCalledWith(2, 'w1', 's1', true);
  });

  it('shows the template summary, and no AI, when AI is not configured', async () => {
    aiStatus.data = { configured: false };
    getSessionAnalysis
      .mockResolvedValueOnce({ ...analysis, summary: null, summarySource: null, summaryStatus: 'not_requested' })
      .mockResolvedValueOnce({ ...analysis, summary: { ...analysis.summary!, text: 'The visitor went from / to /cart in 40s.' }, summarySource: 'rules' });
    await renderPanel();
    expect(await screen.findByText('The visitor went from / to /cart in 40s.')).toBeTruthy();
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.queryByText(/AI summary/)).toBeNull();
    expect(screen.queryByLabelText('Ask AI about this')).toBeNull();
  });

  it('says when a session has no signals', async () => {
    getSessionAnalysis.mockResolvedValue({ ...analysis, score: 0, counts: {}, signals: [], summary: null, summaryStatus: 'no_data' });
    await renderPanel();
    expect(await screen.findByText('No frustration signals found in this session.')).toBeTruthy();
    expect(screen.getByText('Not enough recorded activity to summarise this session.')).toBeTruthy();
  });

  it('offers a retry when the analysis cannot be read', async () => {
    // The panel retries once by itself before giving up.
    getSessionAnalysis.mockRejectedValue(new Error('500'));
    await renderPanel();
    const retry = await screen.findByText('Retry', undefined, { timeout: 4000 });
    getSessionAnalysis.mockResolvedValue(analysis);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText('The coupon button kept failing on /cart.')).toBeTruthy());
  });
});
