const fs = require('node:fs');
const path = require('node:path');

const isDev = process.env.NODE_ENV === 'development';

/**
 * The SPA-shell rules from public/_redirects (`/from  /to  200`), as Next
 * rewrites. Each dynamic page is built for one placeholder id, and in
 * production Cloudflare Pages maps every real id onto that shell. `next dev`
 * never reads _redirects, so without this any real id (/websites/demo) fails
 * the generateStaticParams check. One file stays the source of truth for both.
 */
function shellRewrites() {
  return fs.readFileSync(path.join(__dirname, 'public/_redirects'), 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split(/\s+/))
    // Passthroughs (`/websites/manage` onto itself) exist only to stop the
    // wildcards hijacking real pages; Next already serves those first.
    .filter(([source, destination, status]) => status === '200' && source !== destination)
    // The `.txt` twins serve the static export's RSC payload files; `next dev`
    // answers RSC requests itself and has no such files.
    .filter(([source]) => !source.endsWith('.txt'))
    .map(([source, destination]) => ({ source, destination }));
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev runs as a normal server so the rewrites below apply; builds stay a
  // static export.
  ...(isDev ? { rewrites: async () => shellRewrites() } : { output: 'export' }),
  // next/image's default loader shells out to `sharp`, a native binary —
  // doesn't run in Cloudflare's Workers runtime, and static export can't use
  // it anyway (Image Optimization with the default loader is in Next's own
  // "Unsupported Features" list for output: 'export'). No Cloudflare Images
  // loader configured yet, so images render at native size, unoptimized.
  images: {
    unoptimized: true,
  },
  // rewrites(), headers(), and middleware.ts are all unsupported under
  // output: 'export' — no Next.js server is left at request time to run
  // them. Replaced by Cloudflare Pages Functions and static config files:
  //   - rewrites()   -> functions/api/v1/[[path]].ts and its siblings
  //   - headers()    -> public/_headers
  //   - middleware.ts -> functions/_middleware.ts
  //   - route.ts handlers (POST-only, so couldn't stay as Next route
  //     handlers under export anyway) -> functions/api/**
};

module.exports = nextConfig;
