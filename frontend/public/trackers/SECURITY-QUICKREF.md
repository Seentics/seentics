# Tracking Scripts Security Features - Quick Reference

## 🔒 Three Security Layers Implemented

### 1️⃣ Exponential Retry Backoff ✅
**What:** Automatic retry of failed API requests with increasing delays  
**Benefit:** Prevents server overload, ensures data delivery  
**Config:** 1s → 2s → 4s → 8s → ... → 60s max

### 2️⃣ Content Security Policy (CSP) ✅
**What:** HTTP headers that restrict which resources can load  
**Benefit:** Prevents XSS attacks and unauthorized script injection  
**Implementation:** Meta tag or server header

### 3️⃣ Script Integrity Verification (SRI) ✅
**What:** Cryptographic hash verification to detect tampering  
**Benefit:** Ensures scripts haven't been modified  
**Format:** SHA-256 base64 hash

---

## 🚀 Quick Start

### Development Setup
```html
<!-- Minimal setup (no security) -->
<script src="/trackers/seentics-core.js" 
        data-website-id="YOUR_SITE_ID"></script>
<script src="/trackers/seentics-analytics.js"></script>
```

### Production Setup (Recommended)
```html
<!-- CSP Header -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self'; 
               connect-src 'self' https://api.seentics.com;">

<!-- Scripts with SRI -->
<script src="/trackers/seentics-core.js" 
        data-website-id="YOUR_SITE_ID"
        integrity="sha256-g7w61aA2R0fM+MTpWcoaSIvErtkeIABlyg+vt77QncQ="
        crossorigin="anonymous"></script>
<script src="/trackers/seentics-analytics.js" 
        integrity="sha256-HIrd46wWJFTa7PsZBrYirpaus+KwSdpc8etM3IoOp8I="
        crossorigin="anonymous"></script>
```

---

## 📋 Common Tasks

### Generate New Hashes (After Script Changes)
```bash
node scripts/generate-hashes.js
```
Output:
- Console: All hashes with HTML examples
- File: `frontend/public/trackers/integrity-hashes.json`

### Monitor Retry Behavior
```javascript
SEENTICS_CORE.on('queue:error', (data) => {
  console.log(`Retry #${data.retryCount}, wait: ${data.retryDelay}ms`);
});

SEENTICS_CORE.on('queue:flushed', (data) => {
  console.log(`✅ Sent ${data.count} events`);
});
```

### Verify Script Integrity at Runtime
```javascript
// Check if a script has been tampered with
const isValid = await SEENTICS_CORE.integrity.verify(
  '/trackers/seentics-core.js',
  '83bc3ad5a0364747ccf8c4e959ca1a488bc4aed91e200065ca0fafb7bed09dc4'
);

if (!isValid) {
  alert('⚠️ Security Warning: Script integrity check failed!');
}
```

### Generate CSP Nonce (Server-Side)
```javascript
// Node.js/Express
const nonce = require('crypto').randomBytes(16).toString('base64');
res.setHeader('Content-Security-Policy', 
  `script-src 'self' 'nonce-${nonce}'`);

// Use in template
<script src="/trackers/seentics-core.js" nonce="${nonce}"></script>
```

---

## 🔍 Testing

### Test Retry Backoff
1. Open DevTools → Network tab
2. Right-click on API request → Block request URL
3. Watch console for retry attempts:
   ```
   [Seentics] Retry #1, next attempt in 1000ms
   [Seentics] Retry #2, next attempt in 2000ms
   [Seentics] Retry #3, next attempt in 4000ms
   ```

### Test CSP
1. Add CSP header
2. Open DevTools → Console
3. Check for CSP violation errors
4. Adjust `script-src` directive as needed

### Test SRI
1. Add integrity attribute to script tag
2. Modify the script file slightly
3. Reload page → Script should fail to load
4. Check console for integrity error

---

## ⚙️ Configuration

### Current Integrity Hashes
```json
{
  "seentics-core.js": "sha256-g7w61aA2R0fM+MTpWcoaSIvErtkeIABlyg+vt77QncQ=",
  "seentics-analytics.js": "sha256-HIrd46wWJFTa7PsZBrYirpaus+KwSdpc8etM3IoOp8I=",
  "seentics-automation.js": "sha256-Z/kkz+C3teULFzMKOY/cuUCWGSIs8HFcSVbzPW2kM+c=",
  "seentics-funnels.js": "sha256-WFXDTQ3ma+8uofk2b3JnT4EFsidGDOm0lnrhBV8AluY=",
  "seentics-heatmap.js": "sha256-Ucjvv6toenH4Z1S39OdwfYSKzWapUz6uZRruWJdXiJE="
}
```

### Retry Backoff Settings (in seentics-core.js)
```javascript
state: {
  retryCount: 0,
  retryDelay: 1000,      // Initial: 1 second
  maxRetryDelay: 60000   // Maximum: 60 seconds
}
```

### Recommended CSP Header
```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 
    'sha256-g7w61aA2R0fM+MTpWcoaSIvErtkeIABlyg+vt77QncQ=' 
    'sha256-HIrd46wWJFTa7PsZBrYirpaus+KwSdpc8etM3IoOp8I='; 
  connect-src 'self' https://api.seentics.com; 
  img-src 'self' data: https:; 
  style-src 'self' 'unsafe-inline';
```

---

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| **SRI fails after script update** | Run `node scripts/generate-hashes.js` and update HTML |
| **CSP blocks scripts** | Add script hashes to CSP or use nonces |
| **Retry loop never stops** | Check API endpoint, verify CORS headers |
| **Events not sending** | Enable debug mode: `data-debug="true"` |
| **Integrity check always fails** | Ensure `crossorigin="anonymous"` is set |

---

## 📚 Documentation

- **Full Guide:** `frontend/public/trackers/SECURITY.md`
- **Implementation:** `frontend/public/trackers/seentics-core.js`
- **Example:** `frontend/public/trackers/example.html`
- **Hash Generator:** `scripts/generate-hashes.js`

---

## 🎯 Best Practices Checklist

- [ ] Use HTTPS in production
- [ ] Add SRI integrity attributes to all tracking scripts
- [ ] Implement CSP headers (server-side preferred)
- [ ] Monitor retry patterns with event listeners
- [ ] Regenerate hashes after any script modification
- [ ] Test CSP policy before production deployment
- [ ] Enable debug mode during development
- [ ] Use nonces for inline scripts in strict CSP
- [ ] Set `crossorigin="anonymous"` on script tags
- [ ] Keep integrity-hashes.json in version control

---

## 🔗 Quick Links

- [MDN: CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MDN: SRI](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [Report URI](https://report-uri.com/)

---

**Last Updated:** February 2026  
**Tracking Scripts Version:** 2.0  
**Security Features:** Retry Backoff ✅ | CSP ✅ | SRI ✅
