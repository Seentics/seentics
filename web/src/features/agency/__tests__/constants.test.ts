import { describe, expect, it } from 'vitest';
import { DEFAULT_EMBED_SECTIONS, EMBED_SECTIONS } from '@/features/agency/constants';

describe('EMBED_SECTIONS', () => {
  it('lists analytics, recordings, heatmaps in that order', () => {
    expect(EMBED_SECTIONS.map(s => s.id)).toEqual(['analytics', 'recordings', 'heatmaps']);
  });
  it('warns about recordings only', () => {
    const withCaution = EMBED_SECTIONS.filter(s => s.caution).map(s => s.id);
    expect(withCaution).toEqual(['recordings']);
  });
  it('defaults to analytics only', () => {
    expect(DEFAULT_EMBED_SECTIONS).toEqual(['analytics']);
  });
});
