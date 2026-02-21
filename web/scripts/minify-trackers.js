const { minify } = require('terser');
const fs = require('fs');
const path = require('path');

const TRACKERS_DIR = path.join(__dirname, '..', 'public', 'trackers');

const files = [
  'seentics-core.js',
  'seentics-analytics.js',
  'seentics-automation.js',
  'seentics-heatmap.js',
  'seentics-funnels.js',
  'seentics-replay.js'
];

async function run() {
  let totalBefore = 0, totalAfter = 0;

  for (const file of files) {
    const src = fs.readFileSync(path.join(TRACKERS_DIR, file), 'utf8');
    const result = await minify(src, {
      compress: { passes: 2, drop_console: false, pure_getters: true },
      mangle: { toplevel: false },
      output: { comments: /^!|@license|@preserve/ }
    });

    const minFile = file.replace('.js', '.min.js');
    fs.writeFileSync(path.join(TRACKERS_DIR, minFile), result.code);

    const before = Buffer.byteLength(src);
    const after = Buffer.byteLength(result.code);
    totalBefore += before;
    totalAfter += after;
    console.log(`  ${file}: ${before}B -> ${after}B (${Math.round((1 - after / before) * 100)}% smaller)`);
  }

  console.log(`  Total: ${totalBefore}B -> ${totalAfter}B (${Math.round((1 - totalAfter / totalBefore) * 100)}% smaller)`);
}

run().catch(err => { console.error('Minification failed:', err); process.exit(1); });
