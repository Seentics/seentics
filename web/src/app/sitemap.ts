import type { MetadataRoute } from 'next';
import { DOCS_PAGES } from '@/components/docs/nav';
import { SITE_URL } from '@/lib/site';

/**
 * The public pages, for crawlers.
 *
 * Hand-listed rather than derived from the filesystem: most routes under `app/` are
 * signed-in dashboard pages, so a directory walk would need a longer exclude list
 * than this include list, and would silently add anything new that appeared.
 *
 * Blog posts are not here. They come from `content/` at build time and want their own
 * `lastModified` per post — worth doing, but it needs the post loader rather than a
 * static list, so it is deliberately left out instead of half-done.
 */
type Entry = { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] };

/**
 * Documentation is fourteen separate pages now, not one page with anchors, so each
 * topic can be indexed and returned on its own. Derived from `DOCS_NAV` so a new doc
 * page appears here without anyone remembering to add it.
 */
const DOC_ENTRIES: Entry[] = DOCS_PAGES.filter((p) => p.href !== '/docs').map((p) => ({
  path: p.href,
  priority: 0.6,
  changeFrequency: 'monthly',
}));

const PAGES: Entry[] = [
  { path: '/',              priority: 1.0, changeFrequency: 'weekly' },
  { path: '/pricing',       priority: 0.9, changeFrequency: 'weekly' },
  { path: '/docs',          priority: 0.8, changeFrequency: 'weekly' },
  ...DOC_ENTRIES,
  { path: '/blog',          priority: 0.7, changeFrequency: 'weekly' },
  { path: '/contact',       priority: 0.5, changeFrequency: 'yearly' },
  { path: '/terms',         priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy',       priority: 0.3, changeFrequency: 'yearly' },
  { path: '/refund-policy', priority: 0.3, changeFrequency: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
