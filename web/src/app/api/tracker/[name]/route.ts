import { NextRequest, NextResponse } from 'next/server';
import * as esbuild from 'esbuild';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

// Served once per process — prebuilt files from `npm run build` (preferred) or esbuild on first request (dev).
type Cached = { code: string; etag: string };
const cache = new Map<string, Cached>();

const entries: Record<string, string> = {
  'seentics.js': path.join(process.cwd(), 'trackers', 'index.ts'),
  'rrweb.js':    path.join(process.cwd(), 'trackers', 'rrweb-loader.ts'),
};

function prebuiltPath(name: string): string {
  return path.join(process.cwd(), 'public', 'trackers', name);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const entry = entries[name];
  if (!entry) return new NextResponse('Not Found', { status: 404 });

  const ifNoneMatch = req.headers.get('if-none-match');
  let hit = cache.get(name);

  if (!hit) {
    const staticFile = prebuiltPath(name);
    let code: string;

    if (fs.existsSync(staticFile)) {
      code = fs.readFileSync(staticFile, 'utf8');
    } else {
      let result: esbuild.BuildResult;
      try {
        result = await esbuild.build({
          entryPoints:   [entry],
          bundle:        true,
          minify:        true,
          format:        'iife',
          target:        ['chrome80', 'firefox80', 'safari14', 'edge80'],
          treeShaking:   true,
          platform:      'browser',
          define:        { 'process.env.NODE_ENV': '"production"' },
          legalComments: 'none',
          write:         false,
        });
      } catch (err) {
        console.error(`[tracker] esbuild failed for ${name}:`, err);
        return new NextResponse('Build error', { status: 500 });
      }

      const out = result.outputFiles?.[0];
      if (!out) {
        console.error(`[tracker] esbuild produced no output for ${name}`);
        return new NextResponse('Build error', { status: 500 });
      }
      code = out.text;
    }

    const etag = `"${crypto.createHash('sha256').update(code).digest('hex').slice(0, 16)}"`;
    hit = { code, etag };
    cache.set(name, hit);
  }

  if (ifNoneMatch === hit.etag) {
    return new NextResponse(null, { status: 304 });
  }

  return new NextResponse(hit.code, {
    status: 200,
    headers: {
      'Content-Type':  'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      'ETag':          hit.etag,
    },
  });
}
