const esbuild = require('esbuild');
const zlib    = require('zlib');
const fs      = require('fs');
const path    = require('path');

const ROOT   = path.join(__dirname, '..');
const outDir = path.join(ROOT, 'public', 'trackers');

async function run() {
  fs.mkdirSync(outDir, { recursive: true });

  // ── 1. Main tracker — seentics.js (no rrweb; loaded lazily at runtime) ─────
  console.log('Building seentics.js...');
  await esbuild.build({
    entryPoints:   [path.join(ROOT, 'trackers', 'index.ts')],
    bundle:        true,
    minify:        true,
    format:        'iife',
    target:        ['chrome80', 'firefox80', 'safari14', 'edge80'],
    outfile:       path.join(outDir, 'seentics.js'),
    treeShaking:   true,
    platform:      'browser',
    define:        { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'none',
  });

  // ── 2. rrweb standalone — rrweb.js (sets window.__rrweb_record) ───────────
  console.log('Building rrweb.js...');
  await esbuild.build({
    entryPoints:   [path.join(ROOT, 'trackers', 'rrweb-loader.ts')],
    bundle:        true,
    minify:        true,
    format:        'iife',
    target:        ['chrome80', 'firefox80', 'safari14', 'edge80'],
    outfile:       path.join(outDir, 'rrweb.js'),
    treeShaking:   true,
    platform:      'browser',
    define:        { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'none',
  });

  // ── Size report ────────────────────────────────────────────────────────────
  for (const name of ['seentics.js', 'rrweb.js']) {
    const file    = path.join(outDir, name);
    const size    = fs.statSync(file).size;
    const gzipped = zlib.gzipSync(fs.readFileSync(file));
    console.log(`  ${name} → ${(size / 1024).toFixed(1)} KB minified / ${(gzipped.length / 1024).toFixed(1)} KB gzipped`);
  }
  console.log('Tracker build complete.');
}

run().catch(err => { console.error('Tracker build failed:', err); process.exit(1); });
