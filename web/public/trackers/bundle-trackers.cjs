#!/usr/bin/env node
/**
 * Pre-bundle browser trackers before `next build` / `next dev`.
 *
 * Sources in public/trackers/ (plain JavaScript):
 *   seentics.js         — the core every visitor loads
 *   ext-heatmaps.js     — heatmap capture, loaded where heatmaps are on
 *   ext-automations.js  — automation listeners and actions, loaded where a site has some
 *   ext-replay.js       — recording sidecars, loaded for recorded sessions
 *   rrweb-loader.ts     — rrweb, the DOM recorder, loaded for recorded sessions
 *
 * Outputs (same directory):
 *   seentics.min.js            the core ← used by the install snippet's <script> tag
 *   seentics-{l,a,r}.<hash>.min.js   the extensions, content-hashed so they can be cached
 *                                    forever; the core is built knowing their names
 *   seentics-dom.min.js        rrweb (neutral name: filter lists block the literal
 *                              filename `rrweb.min.js`, which silently disabled session
 *                              replay for every blocker user)
 *
 * Extension names are short and neutral for the same reason — no "heatmap", no "replay".
 */
const crypto  = require('crypto');
const esbuild = require('esbuild');
const fs      = require('fs');
const path    = require('path');

const trackersDir = __dirname; // script lives inside public/trackers/

const common = {
  bundle:        true,
  minify:        true,
  format:        'iife',
  target:        ['chrome80', 'firefox80', 'safari14', 'edge80'],
  treeShaking:   true,
  platform:      'browser',
  define:        { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  write:         false,
};

const EXTENSIONS = {
  l: 'ext-heatmaps.js',
  a: 'ext-automations.js',
  r: 'ext-replay.js',
};

const HASHED_OUTPUT = /^seentics-[lard]\.[0-9a-f]{10}\.min\.js$/;

async function build(entry, extra = {}) {
  const result = await esbuild.build({ ...common, ...extra, entryPoints: [path.join(trackersDir, entry)] });
  const text = result.outputFiles?.[0]?.text;
  if (!text) throw new Error(`bundle-trackers: no output for ${entry}`);
  return text;
}

async function main() {
  // Previous builds' extensions: each build names its own, so old ones would pile up.
  for (const file of fs.readdirSync(trackersDir)) {
    if (HASHED_OUTPUT.test(file)) fs.rmSync(path.join(trackersDir, file));
  }

  const names = {};
  const writeHashed = (key, text) => {
    const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 10);
    names[key] = `seentics-${key}.${hash}.min.js`;
    fs.writeFileSync(path.join(trackersDir, names[key]), text);
  };
  for (const [key, entry] of Object.entries(EXTENSIONS)) writeHashed(key, await build(entry));

  // rrweb: a content-hashed copy (`d`) the core loads and browsers cache for good, and
  // the fixed name for `data-rrweb-src` setups and cores built before the hashed copy.
  const recorder = await build('rrweb-loader.ts');
  writeHashed('d', recorder);
  fs.writeFileSync(path.join(trackersDir, 'seentics-dom.min.js'), recorder);

  const core = await build('seentics.js', {
    define: { ...common.define, __SNC_EXTENSIONS__: JSON.stringify(names) },
  });
  fs.writeFileSync(path.join(trackersDir, 'seentics.min.js'), core);

  console.log(`[bundle-trackers] public/trackers/: seentics.min.js, ${Object.values(names).join(', ')}, seentics-dom.min.js`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
