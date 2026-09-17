/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
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
