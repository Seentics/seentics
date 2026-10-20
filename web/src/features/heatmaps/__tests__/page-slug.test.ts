import { describe, expect, it } from 'vitest';
import { heatmapPageSlug, heatmapPathFromSlug } from '@/features/heatmaps/api';

describe('heatmap page slug', () => {
  it('round-trips paths, underscores and non-ASCII included', () => {
    // `_` stood for `/`, so `/pricing_plans` used to open `/pricing/plans`.
    for (const path of ['/', '/pricing_plans', '/blog/my_post', '/orders/:id', '/ক্যাটালগ/নতুন', '/a b/c%20d']) {
      const slug = heatmapPageSlug(path);
      expect(slug).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(heatmapPathFromSlug(slug)).toBe(path);
    }
  });

  it('normalizes what it encodes', () => {
    expect(heatmapPathFromSlug(heatmapPageSlug('https://example.com/pricing/?ref=x#top'))).toBe('/pricing');
  });

  it('still opens links made with the old `_` encoding', () => {
    expect(heatmapPathFromSlug('_pricing')).toBe('/pricing');
    expect(heatmapPathFromSlug('_blog_post')).toBe('/blog/post');
    expect(heatmapPathFromSlug(encodeURIComponent('_blog_post'))).toBe('/blog/post');
    expect(heatmapPathFromSlug('_')).toBe('/');
  });

  it('reads a missing slug as the home page', () => {
    expect(heatmapPathFromSlug(undefined)).toBe('/');
    expect(heatmapPathFromSlug('')).toBe('/');
  });
});
