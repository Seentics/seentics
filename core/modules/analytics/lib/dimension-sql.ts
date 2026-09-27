/**
 * How the dashboard groups pages, referrers, browsers and operating systems.
 *
 * The tracker stores raw values — `page` is `location.href`, `referrer` is
 * `document.referrer`, `browser`/`os` carry a version — and the reports grouped by them
 * as stored, which split one thing into many rows:
 *
 * - pages by full URL, so `/pricing` and `/pricing?utm_source=x` (every tagged landing)
 *   were different pages, each with a share of the traffic;
 * - referrers by full URL, so every `t.co/…` link was its own "referrer" and the UI
 *   merged them back by domain from the top 50 only, summing unique visitors across
 *   rows as it went;
 * - browsers and OSes by version, so Chrome 127 and Chrome 128 competed for the list.
 *
 * Each expression normalises at read time. Measured on 2.5M pageviews, the string work
 * is noise next to the scan itself (grouping by raw page 2.7 s, by path 2.4–2.6 s).
 * The TypeScript twins exist for the tests; the SQL is what runs.
 */

/**
 * Path of a page URL: no scheme, host, query string or fragment; `/` when empty.
 * A value that is not an absolute URL is treated as a path already.
 */
export const pagePathSql = (col: string) =>
  `coalesce(nullif(split_part(split_part(regexp_replace(${col}, '^[a-z][a-z0-9+.-]*://[^/?#]*', '', 'i'), '?', 1), '#', 1), ''), '/')`;

export function pagePath(url: string): string {
  const stripped = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, "");
  return stripped.split("?")[0]!.split("#")[0]! || "/";
}

/**
 * Referrer host without `www.`, lowercased — `google.com`, `t.co`, `news.ycombinator.com`.
 * Non-http referrers keep their authority (`android-app://com.google.android.gm` →
 * `com.google.android.gm`). NULL when there is no host.
 */
export const referrerDomainSql = (col: string) =>
  `nullif(lower(regexp_replace(substring(${col} from '^[a-z][a-z0-9+.-]*://([^/?#:]+)'), '^www\\.', '', 'i')), '')`;

export function referrerDomain(url: string | null | undefined): string | null {
  const m = url == null ? null : /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i.exec(url);
  return m ? m[1]!.toLowerCase().replace(/^www\./, "") || null : null;
}

/** Browser or OS without its trailing version: `Chrome 128.0` → `Chrome`, `macOS 14.6` → `macOS`. */
export const withoutVersionSql = (col: string) =>
  `nullif(trim(regexp_replace(${col}, '\\s+v?[0-9][0-9._]*$', '')), '')`;

export function withoutVersion(value: string): string {
  return value.replace(/\s+v?[0-9][0-9._]*$/, "").trim();
}
