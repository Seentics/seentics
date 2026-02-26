#!/usr/bin/env node

/**
 * Generate SHA-256 integrity hashes for the Seentics tracking script
 * Usage: node generate-hashes.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const trackerDir = path.join(__dirname, '../web/public/trackers');
const files = ['seentics.js'];

console.log('======================================');
console.log('  Seentics Script Integrity Hashes');
console.log('======================================\n');

const results = {};

files.forEach(file => {
  const filePath = path.join(trackerDir, file);

  if (!fs.existsSync(filePath)) {
    console.log(`  ${file} - NOT FOUND\n`);
    return;
  }

  const content = fs.readFileSync(filePath);
  const size = (content.length / 1024).toFixed(2);

  const base64Hash = crypto.createHash('sha256').update(content).digest('base64');
  const hexHash = crypto.createHash('sha256').update(content).digest('hex');

  results[file] = { base64Hash, hexHash, size };

  console.log(`  ${file} (${size} KB)`);
  console.log(`   integrity="sha256-${base64Hash}"`);
  console.log(`   hex: ${hexHash}\n`);
});

// HTML snippet
console.log('======================================');
console.log('  HTML Integration Example');
console.log('======================================\n');

console.log('<!-- Add to your <head> section -->');
files.forEach(file => {
  if (results[file]) {
    console.log(`<script src="/trackers/${file}" data-site-id="YOUR_SITE_ID"`);
    console.log(`        integrity="sha256-${results[file].base64Hash}"`);
    console.log('        crossorigin="anonymous"></script>');
  }
});

// JSON output
const jsonOutput = {};
Object.keys(results).forEach(file => {
  jsonOutput[file] = { base64: results[file].base64Hash, hex: results[file].hexHash, size: results[file].size + ' KB' };
});

console.log('\n' + JSON.stringify(jsonOutput, null, 2));
