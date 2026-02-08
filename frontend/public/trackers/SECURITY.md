# Seentics Tracking Scripts - Security Guide

## Overview

This guide covers the security features implemented in Seentics tracking scripts, including retry backoff, Content Security Policy (CSP), and script integrity verification.

## Features

### 1. Exponential Retry Backoff

Failed API requests are automatically retried with exponentially increasing delays to prevent server overload.

**How it works:**
- Initial retry delay: 1 second
- Maximum retry delay: 60 seconds
- Delay doubles after each failed attempt
- Resets to 1 second on successful request

**Example:**
```
Attempt 1: Immediate
Attempt 2: 1 second delay
Attempt 3: 2 seconds delay
Attempt 4: 4 seconds delay
Attempt 5: 8 seconds delay
...up to 60 seconds max
```

**Monitoring:**
```javascript
SEENTICS_CORE.on('queue:error', (data) => {
  console.log(`Retry #${data.retryCount}, next in ${data.retryDelay}ms`);
});
```

### 2. Content Security Policy (CSP)

CSP headers prevent XSS attacks by controlling which resources can load on your page.

**Implementation:**

Add to your HTML `<head>`:

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' https://your-cdn.com; 
               connect-src 'self' https://api.seentics.com; 
               img-src 'self' data: https:; 
               style-src 'self' 'unsafe-inline';">
```

**For stricter security (recommended):**

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'nonce-{RANDOM_NONCE}'; 
               connect-src 'self' https://api.seentics.com; 
               img-src 'self' data: https:; 
               style-src 'self';">
```

Then add the nonce to your scripts:

```html
<script src="/trackers/seentics-core.js" 
        nonce="{RANDOM_NONCE}"
        data-website-id="YOUR_SITE_ID"></script>
```

**Generate nonce server-side:**
```javascript
// Node.js example
const crypto = require('crypto');
const nonce = crypto.randomBytes(16).toString('base64');
```

**Or use the built-in generator:**
```javascript
const nonce = SEENTICS_CORE.integrity.generateNonce();
```

### 3. Subresource Integrity (SRI)

Verify that scripts haven't been tampered with by comparing cryptographic hashes.

**Step 1: Generate hash for your scripts**

```bash
# Using OpenSSL
openssl dgst -sha256 -binary seentics-core.js | openssl base64 -A

# Using Node.js
node -e "const crypto = require('crypto'); const fs = require('fs'); const hash = crypto.createHash('sha256').update(fs.readFileSync('seentics-core.js')).digest('base64'); console.log('sha256-' + hash);"
```

**Step 2: Add integrity attribute**

```html
<script src="/trackers/seentics-core.js" 
        integrity="sha256-YOUR_GENERATED_HASH"
        crossorigin="anonymous"
        data-website-id="YOUR_SITE_ID"></script>
```

**Example:**
```html
<script src="https://cdn.example.com/trackers/seentics-core.js" 
        integrity="sha256-abc123def456..."
        crossorigin="anonymous"
        data-website-id="12345"></script>
```

**Important:** 
- Update integrity hash whenever you modify the script
- Use `crossorigin="anonymous"` for CDN-hosted scripts
- Browser will refuse to execute if hash doesn't match

### 4. Runtime Integrity Verification

Verify script integrity at runtime using the built-in verifier:

```javascript
// Verify a script URL matches expected hash
const isValid = await SEENTICS_CORE.integrity.verify(
  'https://cdn.example.com/trackers/seentics-core.js',
  'abc123def456...' // Expected SHA-256 hash (hex format)
);

if (!isValid) {
  console.error('Script integrity compromised!');
  // Take action: disable tracking, alert admin, etc.
}
```

**Use case:** Verify third-party scripts before loading:

```javascript
async function loadSecureScript(url, expectedHash) {
  const isValid = await SEENTICS_CORE.integrity.verify(url, expectedHash);
  
  if (isValid) {
    const script = document.createElement('script');
    script.src = url;
    document.head.appendChild(script);
  } else {
    console.error('Failed to load script - integrity check failed');
  }
}

// Usage
loadSecureScript(
  'https://cdn.example.com/plugin.js',
  'a7f8b3c2d1e9...' // Expected hash
);
```

## Complete Secure Setup Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Strict CSP Policy -->
  <meta http-equiv="Content-Security-Policy" 
        content="default-src 'self'; 
                 script-src 'self' 'nonce-{SERVER_GENERATED_NONCE}'; 
                 connect-src 'self' https://api.seentics.com; 
                 img-src 'self' data: https:; 
                 style-src 'self';">
  
  <!-- Core with SRI -->
  <script src="/trackers/seentics-core.js" 
          integrity="sha256-CORE_HASH"
          crossorigin="anonymous"
          nonce="{SERVER_GENERATED_NONCE}"
          data-website-id="YOUR_SITE_ID"></script>
  
  <!-- Analytics with SRI -->
  <script src="/trackers/seentics-analytics.js" 
          integrity="sha256-ANALYTICS_HASH"
          crossorigin="anonymous"
          nonce="{SERVER_GENERATED_NONCE}"></script>
          
  <title>Secure Tracking Example</title>
</head>
<body>
  <!-- Your content -->
  
  <!-- Monitor retry behavior -->
  <script nonce="{SERVER_GENERATED_NONCE}">
    SEENTICS_CORE.on('queue:error', (data) => {
      // Log to your monitoring service
      console.warn('Tracking retry:', data);
    });
    
    SEENTICS_CORE.on('queue:flushed', (data) => {
      console.log('Events sent:', data.count);
    });
  </script>
</body>
</html>
```

## CDN Hosting with SRI

If hosting scripts on a CDN, always use SRI:

```html
<!-- ✅ GOOD: SRI + crossorigin -->
<script src="https://cdn.example.com/seentics-core.js" 
        integrity="sha256-HASH"
        crossorigin="anonymous"></script>

<!-- ❌ BAD: No integrity check -->
<script src="https://cdn.example.com/seentics-core.js"></script>
```

## Server-Side CSP Headers (Recommended)

Instead of meta tags, use HTTP headers for better security:

### Nginx
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'nonce-$request_id'; connect-src 'self' https://api.seentics.com; img-src 'self' data: https:; style-src 'self';" always;
```

### Apache
```apache
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'nonce-%{REQUEST_ID}e'; connect-src 'self' https://api.seentics.com; img-src 'self' data: https:; style-src 'self';"
```

### Node.js (Express)
```javascript
const crypto = require('crypto');

app.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.nonce = nonce;
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'; connect-src 'self' https://api.seentics.com; img-src 'self' data: https:; style-src 'self';`
  );
  next();
});
```

## Hash Generation Script

Save this as `generate-hashes.js`:

```javascript
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const trackerDir = './public/trackers';
const files = [
  'seentics-core.js',
  'seentics-analytics.js',
  'seentics-automation.js',
  'seentics-funnels.js',
  'seentics-heatmap.js'
];

console.log('# Script Integrity Hashes\n');

files.forEach(file => {
  const filePath = path.join(trackerDir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath);
    
    // Base64 (for integrity attribute)
    const base64Hash = crypto
      .createHash('sha256')
      .update(content)
      .digest('base64');
    
    // Hex (for runtime verification)
    const hexHash = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
    
    console.log(`## ${file}`);
    console.log(`integrity="sha256-${base64Hash}"`);
    console.log(`hex: ${hexHash}`);
    console.log('');
  }
});
```

Run: `node generate-hashes.js`

## Testing Your Setup

### 1. Test CSP
Open browser DevTools → Console. You should see no CSP violations.

### 2. Test SRI
Modify a script file slightly. Browser should refuse to load it.

### 3. Test Retry Backoff
Block API calls in Network tab. Watch console for retry attempts:
```
[Seentics] Retry #1, next attempt in 1000ms
[Seentics] Retry #2, next attempt in 2000ms
[Seentics] Retry #3, next attempt in 4000ms
```

### 4. Test Integrity Verification
```javascript
// Test with correct hash
const valid = await SEENTICS_CORE.integrity.verify(
  '/trackers/seentics-core.js',
  'CORRECT_HASH'
);
console.log('Valid:', valid); // Should be true

// Test with wrong hash
const invalid = await SEENTICS_CORE.integrity.verify(
  '/trackers/seentics-core.js',
  'WRONG_HASH'
);
console.log('Invalid:', invalid); // Should be false
```

## Best Practices

1. **Always use HTTPS** in production
2. **Enable CSP headers** at the server level, not just meta tags
3. **Use SRI for CDN-hosted scripts**
4. **Rotate nonces** on every page load (server-side)
5. **Monitor retry patterns** to detect API issues early
6. **Update hashes** whenever scripts change
7. **Test CSP** before deploying to production
8. **Log integrity failures** for security auditing

## Troubleshooting

### CSP blocking scripts
- Check browser console for CSP violation reports
- Ensure all script sources are whitelisted
- Use nonces for inline scripts

### SRI verification fails
- Regenerate hash after any script changes
- Ensure no whitespace/minification differences
- Check `crossorigin="anonymous"` is set

### Retry backoff not working
- Check `config.debug = true` to see logs
- Verify API endpoint is correct
- Check network tab for actual errors

## Security Checklist

- [ ] CSP headers configured (server-side preferred)
- [ ] SRI integrity attributes on all tracking scripts
- [ ] HTTPS only (no mixed content)
- [ ] Nonces rotated on each request
- [ ] Retry backoff monitoring enabled
- [ ] Failed event persistence tested
- [ ] Third-party scripts verified with integrity checker
- [ ] CSP tested in all target browsers
- [ ] Security headers audited with https://securityheaders.com

## Additional Resources

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MDN: Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [Report URI](https://report-uri.com/) - CSP violation monitoring

## Support

For security issues or questions:
- Email: security@seentics.com
- Documentation: https://docs.seentics.com/security
