const { minify } = require('terser');
const fs = require('fs');
const path = require('path');

const TRACKERS_DIR = path.join(__dirname, '..', 'public', 'trackers');

// Source files use .src.js extension; output replaces .src.js with .js
const sources = ['seentics.src.js'];

async function run() {
  let totalBefore = 0, totalAfter = 0;

  for (const srcFile of sources) {
    const src = fs.readFileSync(path.join(TRACKERS_DIR, srcFile), 'utf8');
    const result = await minify(src, {
      compress: { passes: 2, drop_console: false, pure_getters: true },
      mangle: { toplevel: false },
      output: { comments: /^!|@license|@preserve/ }
    });

    // Write minified output as the served file (e.g. seentics.src.js -> seentics.js)
    const outFile = srcFile.replace('.src.js', '.js');
    fs.writeFileSync(path.join(TRACKERS_DIR, outFile), result.code);

    const before = Buffer.byteLength(src);
    const after = Buffer.byteLength(result.code);
    totalBefore += before;
    totalAfter += after;
    console.log(`  ${srcFile} -> ${outFile}: ${before}B -> ${after}B (${Math.round((1 - after / before) * 100)}% smaller)`);
  }

  console.log(`  Total: ${totalBefore}B -> ${totalAfter}B (${Math.round((1 - totalAfter / totalBefore) * 100)}% smaller)`);
}

run().catch(err => { console.error('Minification failed:', err); process.exit(1); });
