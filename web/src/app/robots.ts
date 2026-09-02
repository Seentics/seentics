import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * There was no robots.txt at all, so crawlers had no guidance and no pointer to a
 * sitemap.
 *
 * The disallow list is the app itself. Everything under `/websites` is a signed-in
 * dashboard, `/admin` and `/agency` are operator surfaces, and the token-bearing
 * routes (`/share`, `/client-portal`, `/accept-invite`, `/reset-password`) must never
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
          '/admin/',
          '/agency/',
          '/agency-solution/',
          '/client-portal/',
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
