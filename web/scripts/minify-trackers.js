const esbuild = require('esbuild');
const zlib    = require('zlib');
const fs      = require('fs');
const path    = require('path');

const ROOT = path.join(__dirname, '..');

async function run() {
  const srcPath = path.join(ROOT, 'trackers', 'index.ts');
  const outPath = path.join(ROOT, 'public', 'trackers', 'seentics.js');

  console.log('Building Seentics tracker (rrweb + gzip)...');

  await esbuild.build({
    entryPoints: [srcPath],
    bundle:      true,
    minify:      true,
    format:      'iife',       // self-contained, no global exports
    target:      ['chrome80', 'firefox80', 'safari14', 'edge80'],
    outfile:     outPath,
    treeShaking: true,
    platform:    'browser',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    legalComments: 'none',
  });

  const minifiedSize = fs.statSync(outPath).size;
  const gzipped      = zlib.gzipSync(fs.readFileSync(outPath));
  console.log(
    `  seentics.js → ${(minifiedSize / 1024).toFixed(1)} KB minified` +
    ` / ${(gzipped.length / 1024).toFixed(1)} KB gzipped`
  );
  console.log('Tracker build complete.');
}

run().catch(err => { console.error('Tracker build failed:', err); process.exit(1); });
