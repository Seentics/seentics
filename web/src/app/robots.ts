import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Required under output: 'export' — this route has no dynamic input, so
// it's just making that explicit rather than a behavior change.
export const dynamic = 'force-static';

/**
 * There was no robots.txt at all, so crawlers had no guidance and no pointer to a
 * sitemap.
 *
 * The disallow list is the app itself. Everything under `/websites` and `/agency` is a signed-in
 * dashboard, and the token-bearing
 * routes (`/share`, `/accept-invite`, `/reset-password`) must never
 * be indexed — a crawled reset link is a leaked reset link.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/websites/',
          '/agency/',
          '/share/',
          '/accept-invite/',
          '/preview/',
          '/checkout/',
          '/setup/',
          '/signin',
          '/signup',
          '/forgot-password',
          '/reset-password',
          '/funnel-test-sandbox/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
