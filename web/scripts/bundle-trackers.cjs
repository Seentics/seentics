#!/usr/bin/env node
/**
 * Pre-bundle browser trackers before `next build`.
 * Production standalone images omit `rrweb` from traced node_modules, so runtime
 * esbuild in /api/tracker/[name] cannot resolve `rrweb` → 500 on rrweb.js.
 * These files are copied into the image via `public/` + Dockerfile.
 */
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const bundles = {
  'seentics.js': path.join(root, 'trackers', 'index.ts'),
  'rrweb.js': path.join(root, 'trackers', 'rrweb-loader.ts'),
};

async function main() {
  const outDir = path.join(root, 'public', 'trackers');
  fs.mkdirSync(outDir, { recursive: true });

  for (const [outName, entry] of Object.entries(bundles)) {
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      minify: true,
      format: 'iife',
      target: ['chrome80', 'firefox80', 'safari14', 'edge80'],
      treeShaking: true,
      platform: 'browser',
      define: { 'process.env.NODE_ENV': '"production"' },
      legalComments: 'none',
      write: false,
    });
    const file = result.outputFiles?.[0];
    if (!file?.text) throw new Error(`bundle-trackers: no output for ${outName}`);
    fs.writeFileSync(path.join(outDir, outName), file.text);
  }

  console.log('[bundle-trackers] Wrote', Object.keys(bundles).join(', '), '→ public/trackers/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
