#!/usr/bin/env node
// Turns public/_redirects into a Caddy `map` for the self-hosted image (web/Dockerfile).
//
// Cloudflare Pages reads _redirects itself; the Docker image serves the same static export
// from Caddy, which does not. Generating the map at build time keeps _redirects the one
// source of truth for both: a rule added there reaches self-hosters without a second edit.
//
// Only `200` rules are shell rewrites, and only those are emitted. Order is kept, because
// the first matching rule wins in both places (passthroughs and nested routes come first).
//
// Usage: node scripts/caddy-shell-rules.cjs <_redirects> <out.caddy>

const fs = require('node:fs');

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: caddy-shell-rules.cjs <_redirects> <out.caddy>');
  process.exit(2);
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `/websites/:websiteId/errors.txt` -> `^/websites/[^/]+/errors\.txt$` */
function toRegex(source) {
  return '^' + source.split(/(:[A-Za-z]+)/).map((part) => (part.startsWith(':') ? '[^/]+' : escape(part))).join('') + '$';
}

const rules = fs.readFileSync(input, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split(/\s+/))
  .filter(([, , status]) => status === '200');

if (rules.length === 0) {
  console.error(`${input}: no 200 rules found — refusing to write an empty map`);
  process.exit(1);
}

for (const [source, destination] of rules) {
  if (source.includes('*') || destination.includes(':')) {
    // Splats and parameter substitution have no use in the shell rules today; fail loudly
    // rather than emit a rule that silently means something else under Caddy.
    console.error(`${input}: unsupported rule "${source} ${destination}"`);
    process.exit(1);
  }
}

const lines = [
  '# Generated from public/_redirects by scripts/caddy-shell-rules.cjs. Do not edit.',
  'map {path} {seentics_shell} {',
  ...rules.map(([source, destination]) => `\t~${toRegex(source)} ${destination}`),
  '\tdefault ""',
  '}',
  '',
];
fs.writeFileSync(output, lines.join('\n'));
console.log(`${output}: ${rules.length} shell rules`);
