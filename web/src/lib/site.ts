/**
 * The site's public origin.
 *
 * One definition, because it is needed by `metadataBase`, the sitemap and robots.txt,
 * and three copies would drift. Overridable so preview deployments and self-hosters
 * do not emit canonical URLs pointing at seentics.com.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://seentics.com'
).replace(/\/+$/, '');
