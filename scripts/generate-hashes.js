#!/usr/bin/env node

/**
 * Generate SHA-256 integrity hashes for Seentics tracking scripts
 * Usage: node generate-hashes.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const trackerDir = path.join(__dirname, '../frontend/public/trackers');
const files = [
  'seentics-core.js',
  'seentics-analytics.js',
  'seentics-automation.js',
  'seentics-funnels.js',
  'seentics-heatmap.js'
];

console.log('======================================');
console.log('  Seentics Script Integrity Hashes');
console.log('======================================\n');

const results = {};

files.forEach(file => {
  const filePath = path.join(trackerDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${file} - NOT FOUND\n`);
    return;
  }
  
  const content = fs.readFileSync(filePath);
  const size = (content.length / 1024).toFixed(2);
  
  // Base64 hash (for SRI integrity attribute)
  const base64Hash = crypto
    .createHash('sha256')
    .update(content)
    .digest('base64');
  
  // Hex hash (for runtime verification API)
  const hexHash = crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');
  
  results[file] = { base64Hash, hexHash, size };
  
  console.log(`📄 ${file} (${size} KB)`);
  console.log(`   integrity="sha256-${base64Hash}"`);
  console.log(`   hex: ${hexHash}`);
  console.log('');
});

// Generate HTML snippet
console.log('\n======================================');
console.log('  HTML Integration Example');
console.log('======================================\n');

console.log('<!-- Add to your <head> section -->');
files.forEach(file => {
  if (results[file]) {
    const dataAttr = file === 'seentics-core.js' 
      ? ' data-website-id="YOUR_SITE_ID"' 
      : '';
    console.log(`<script src="/trackers/${file}"${dataAttr}`);
    console.log(`        integrity="sha256-${results[file].base64Hash}"`);
    console.log('        crossorigin="anonymous"></script>');
  }
});

// Generate JSON output
console.log('\n======================================');
console.log('  JSON Output');
console.log('======================================\n');

const jsonOutput = {};
Object.keys(results).forEach(file => {
  jsonOutput[file] = {
    base64: results[file].base64Hash,
    hex: results[file].hexHash,
    size: results[file].size + ' KB'
  };
});

console.log(JSON.stringify(jsonOutput, null, 2));

// Save to file
const outputPath = path.join(trackerDir, 'integrity-hashes.json');
fs.writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));
console.log(`\n✅ Hashes saved to: ${outputPath}\n`);

// Generate CSP header recommendation
console.log('======================================');
console.log('  Recommended CSP Header');
console.log('======================================\n');

console.log('Add to your server configuration:\n');
console.log('Content-Security-Policy: default-src \'self\'; \\');
console.log('  script-src \'self\' \\');
files.forEach(file => {
  if (results[file]) {
    console.log(`    \'sha256-${results[file].base64Hash}\' \\`);
  }
});
console.log('  ; \\');
console.log('  connect-src \'self\' https://api.seentics.com; \\');
console.log('  img-src \'self\' data: https:; \\');
console.log('  style-src \'self\' \'unsafe-inline\';\n');
