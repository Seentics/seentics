# Playwright Screenshot System for Heatmaps

This system provides automated server-side screenshot capture for heatmap analysis using Playwright and Chromium. Screenshots are automatically stored in S3 or MinIO for later retrieval.

## Features

- **Automated Capture**: Capture webpage screenshots programmatically without client-side html2canvas
- **Smart Deduplication**: Reuses identical existing screenshots (same hash) - avoids redundant storage
- **S3/MinIO Compatible**: Stores images in any S3-compatible storage (AWS S3, MinIO, etc.)
- **Tracker Integration**: Works seamlessly with seentics.js tracker's heatmap_screenshot events
- **Resource Safe**: Browser pool management to prevent resource exhaustion
- **Flexible Configuration**: Customizable viewport sizes, timeouts, and JPEG quality
- **Batch Processing**: Capture multiple pages in a single request
- **Database Integration**: Automatically updates layout snapshots in the database
- **Check-Only Mode**: Verify if screenshot exists without capturing
- **Error Handling**: Comprehensive error messages and graceful failure handling

## Architecture

### Playwright API Flow
```
Route (POST /heatmaps/:website_id/playwright-screenshot)
    ↓
Service (heatmap-playwright.service.ts)
    ↓
Layout DB Check (existing screenshot hash)
    ↓ (if no match or force=true)
Playwright Screenshots (lib/playwright-screenshots.ts)
    ↓
Browser Manager (lib/playwright-browser.ts) → Chromium
    ↓
S3/MinIO Storage (lib/s3.ts)
    ↓
Database Upsert (lib/layout-db.ts)
```

### Tracker Integration Flow
```
seentics.js tracker
    ↓
POST /tracker/collect (heatmap_screenshot event)
    ↓
Ingest Queue (queues.ts)
    ↓
HeatmapEngine.processEvents()
    ↓
Layout DB Check (deduplication by hash)
    ↓ (if no match or new screenshot)
S3 Storage + Database Update
```

Both flows use the same deduplication logic: SHA256 hash comparison prevents duplicate storage.

## Tracker Integration & Smart Three-Tier Lookup

### How It Works

The system integrates with the seentics.js tracker's existing `heatmap_screenshot` event type. This means:

1. **Tracker-Initiated Screenshots**: When users capture screenshots via the dashboard (html2canvas), they're sent as `heatmap_screenshot` events through `/tracker/collect`
2. **Server-Side Screenshots**: The Playwright API provides programmatic server-side capture
3. **Smart Three-Tier Lookup**: Cache → Database → Playwright

### Three-Tier Lookup Flow (Optimized)

When a screenshot is requested:

```
Request for /page screenshot:
    ↓
1. Check in-memory cache (10ms)
   → Found? Return immediately, no other lookups!
   → Not found? Continue to tier 2
    ↓
2. Query database (10-50ms)
   → Found? Cache it + return, skip Playwright!
   → Not found? Continue to tier 3
    ↓
3. Launch Playwright (2-5 seconds)
   → Capture screenshot
   → Store in S3 + database
   → Cache the new entry
   → Return to user
```

**Performance Impact**:
- **Tier 1 hits** (cache): 10ms response (ultra-fast)
- **Tier 2 hits** (database): 50ms response (fast)
- **Tier 3** (first capture): 2-5s response (one-time cost)
- **Repeated requests**: 10ms (cache hit every time!)

See [SCREENSHOT_CACHING.md](SCREENSHOT_CACHING.md) for detailed caching strategy.

### Check-First Benefits

- **CPU**: No Playwright browser launch if screenshot already exists
- **Memory**: Browser pool not used for repeated pages
- **Speed**: Repeated requests take ~10ms instead of 2-5 seconds
- **Bandwidth**: No S3 API calls for existing screenshots
- **Cost**: Massive savings on browser infrastructure + S3 API calls
- **Consistency**: Both tracker and Playwright API use same check logic

### Bypassing Deduplication

If you need to force a fresh screenshot (e.g., periodic refresh):

```json
{
  "page_url": "https://example.com/page",
  "page_path": "/page",
  "force": true
}
```

With `force: true`:
- Page is always captured (no dedup check before capture)
- If hash matches existing, new version still replaces old
- Useful for: periodic updates, design changes, regression testing

### Check-Only Mode

To verify if a screenshot exists without capturing:

```json
{
  "page_path": "/page",
  "check_only": true
}
```

With `check_only: true`:
- Returns existing screenshot metadata if found
- Returns null if no screenshot exists
- No capture happens, so very fast
- Useful for: checking coverage, audit trails

## Environment Variables

The system uses the existing S3 configuration from your environment:

```bash
# S3 Configuration (existing)
S3_BUCKET=seentics-replays           # S3 bucket name
S3_ENDPOINT=http://minio:9000        # Minio/S3 endpoint (optional)
S3_PUBLIC_ENDPOINT=http://localhost:9000  # Public endpoint for presigned URLs
AWS_REGION=us-east-1                 # AWS region
AWS_ACCESS_KEY_ID=<access-key>       # AWS/MinIO access key
AWS_SECRET_ACCESS_KEY=<secret>       # AWS/MinIO secret key

# Browser Configuration (optional)
PLAYWRIGHT_BROWSER_POOL_SIZE=5       # Max concurrent screenshots (default: 5)
```

## API Endpoints

### Single Screenshot Capture

**POST** `/api/v1/heatmaps/:website_id/playwright-screenshot`

Capture a single webpage screenshot and store in S3.

#### Request Headers
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

#### Request Body
```json
{
  "page_url": "https://example.com/page",
  "page_path": "/page",
  "viewport_width": 1920,
  "viewport_height": 1080,
  "wait_for_selector": "#main-content",
  "jpeg_quality": 85,
  "force": false,
  "check_only": false
}
```

#### Request Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page_url` | string | ✓* | - | Full URL of the page to capture |
| `page_path` | string | ✓ | - | Normalized page path for heatmap (e.g., `/products`) |
| `viewport_width` | number | | 1920 | Browser viewport width in pixels |
| `viewport_height` | number | | 1080 | Browser viewport height in pixels |
| `wait_for_selector` | string | | - | CSS selector to wait for before capturing (optional) |
| `jpeg_quality` | number | | 85 | JPEG quality 1-100 |
| `force` | boolean | | false | Force capture even if identical screenshot exists |
| `check_only` | boolean | | false | Check if screenshot exists without capturing |

*`page_url` is required except when `check_only: true` (checking existence)

#### Response (Success - 200)
```json
{
  "ok": true,
  "data": {
    "success": true,
    "s3Key": "heatmaps/site-uuid/ab12cd34.jpg",
    "imageHash": "sha256hash...",
    "imageWidth": 1920,
    "imageHeight": 1080,
    "sizeBytes": 245678,
    "stored": true,
    "message": "Screenshot captured and stored"
  }
}
```

Response Fields:
- `success`: Always true if request succeeded (no error)
- `s3Key`: S3 location of the screenshot
- `imageHash`: SHA256 hash of the image (used for deduplication)
- `imageWidth`/`imageHeight`: Image dimensions in pixels
- `sizeBytes`: File size in bytes
- `stored`: Whether this was newly captured (`true`) or reused from existing (`false`)
- `message`: Status message explaining what happened

**Note on deduplication**: If an identical screenshot already exists (same hash), `stored` will be `false` and existing metadata is returned. This is NOT an error - the system is working as designed to save storage.

#### Response (Error - 400)
```json
{
  "error": "Failed to navigate to URL: net::ERR_NAME_NOT_RESOLVED"
}
```

#### Status Codes
| Code | Meaning |
|------|---------|
| 200 | Screenshot captured and stored successfully |
| 400 | Invalid request or capture failed |
| 403 | User not authorized to access this website |

### Batch Screenshot Capture

**POST** `/api/v1/heatmaps/:website_id/playwright-batch-screenshots`

Capture multiple webpage screenshots in a single request. Processes sequentially.

#### Request Headers
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

#### Request Body
```json
{
  "screenshots": [
    {
      "page_url": "https://example.com/page1",
      "page_path": "/page1",
      "viewport_width": 1920,
      "viewport_height": 1080
    },
    {
      "page_url": "https://example.com/page2",
      "page_path": "/page2",
      "viewport_width": 1920,
      "viewport_height": 1080
    }
  ]
}
```

#### Response (Success - 200)
```json
{
  "ok": true,
  "summary": {
    "total": 3,
    "succeeded": 3,
    "failed": 0
  },
  "results": [
    {
      "pagePath": "/page1",
      "success": true,
      "s3Key": "heatmaps/site-uuid/ab12cd34.jpg",
      "stored": true,
      "message": "Screenshot captured and stored"
    },
    {
      "pagePath": "/page2",
      "success": true,
      "s3Key": "heatmaps/site-uuid/ab12cd34.jpg",
      "stored": false,
      "message": "Using existing identical screenshot (deduplication)"
    },
    {
      "pagePath": "/page3",
      "success": false,
      "error": "Timeout waiting for network idle"
    }
  ]
}
```

Response fields:
- `summary.total`: Total requests in batch
- `summary.succeeded`: Requests that succeeded (even reused via dedup)
- `summary.failed`: Requests that failed
- `results[].stored`: true if newly captured, false if reused existing
- `results[].message`: Status explanation (helpful for debugging)

#### Constraints
- Maximum 50 screenshots per batch
- Processes sequentially (not in parallel) to avoid resource exhaustion
- Typical processing time: 3-10 seconds per screenshot depending on page complexity

## Usage Examples

### Smart Deduplication Examples

```typescript
// First request - captures and stores
const response1 = await fetch('/api/v1/heatmaps/my-site/playwright-screenshot', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    page_url: 'https://example.com/about',
    page_path: '/about'
  }),
});

const result1 = await response1.json();
// result1.data.stored = true  ✓ Newly captured
// result1.data.sizeBytes = 245678

// Second request - SAME page, SAME URL
const response2 = await fetch('/api/v1/heatmaps/my-site/playwright-screenshot', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    page_url: 'https://example.com/about',
    page_path: '/about'
  }),
});

const result2 = await response2.json();
// result2.data.stored = false  ✓ Reused existing (deduplication!)
// result2.data.sizeBytes = 245678 (same as before, not re-uploaded)
// result2.data.message = "Using existing identical screenshot (deduplication)"

// Force refresh - bypass deduplication
const response3 = await fetch('/api/v1/heatmaps/my-site/playwright-screenshot', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    page_url: 'https://example.com/about',
    page_path: '/about',
    force: true  // Ignore existing, always capture
  }),
});

const result3 = await response3.json();
// result3.data.stored = true  ✓ New capture (even though we had one)

// Check-only mode - verify without capturing
const response4 = await fetch('/api/v1/heatmaps/my-site/playwright-screenshot', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    page_path: '/about',
    check_only: true  // No capture, just check if exists
  }),
});

const result4 = await response4.json();
// result4.data.message = "Screenshot captured and stored" (or null if none exists)
// No browser/network calls made - instant response
```

### JavaScript/TypeScript Client

```typescript
// Single screenshot
const response = await fetch('/api/v1/heatmaps/my-website-id/playwright-screenshot', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    page_url: 'https://example.com/products',
    page_path: '/products',
    viewport_width: 1920,
    viewport_height: 1080,
    jpeg_quality: 90,
  }),
});

const result = await response.json();
if (result.ok) {
  console.log('Screenshot stored at:', result.data.s3Key);
  console.log('Image dimensions:', result.data.imageWidth, 'x', result.data.imageHeight);
  console.log('File size:', result.data.sizeBytes, 'bytes');
}
```

```typescript
// Batch screenshots
const response = await fetch('/api/v1/heatmaps/my-website-id/playwright-batch-screenshots', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    screenshots: [
      { page_url: 'https://example.com/', page_path: '/' },
      { page_url: 'https://example.com/products', page_path: '/products' },
      { page_url: 'https://example.com/pricing', page_path: '/pricing' },
    ],
  }),
});

const result = await response.json();
result.results.forEach((r) => {
  if (r.success) {
    console.log(`✓ ${r.pagePath}`);
  } else {
    console.log(`✗ ${r.pagePath}: ${r.error}`);
  }
});
```

### cURL

```bash
curl -X POST http://localhost:8080/api/v1/heatmaps/my-website/playwright-screenshot \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "page_url": "https://example.com/page",
    "page_path": "/page",
    "viewport_width": 1920,
    "viewport_height": 1080,
    "jpeg_quality": 85
  }'
```

## Configuration

### Memory/Container Limits

For Docker/Kubernetes deployments, allocate adequate resources:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

The system uses:
- Single-process Chromium for memory efficiency
- `/dev/shm` disabled for better container compatibility
- Browser pool limited to 5 concurrent instances by default

### S3/MinIO Setup

MinIO Example (Docker):
```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Create bucket
aws s3 mb s3://seentics-replays --endpoint-url http://localhost:9000
```

Environment Configuration:
```bash
S3_ENDPOINT=http://minio:9000
S3_PUBLIC_ENDPOINT=http://localhost:9000
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
```

## Performance Considerations

### Screenshot Capture Time
- Simple static pages: 1-2 seconds
- Pages with heavy JavaScript: 3-5 seconds
- Pages with animations/lazy loading: 5-10 seconds

### Network Idle Waiting
By default, the system waits for network idle (`waitForNetworkIdle: true`), meaning:
- All network requests complete
- No new requests for 500ms

For faster captures, disable by using client library override:
```typescript
// Modify lib/playwright-screenshots.ts to support this
```

### Concurrent Screenshot Limit
- Default pool size: 5 concurrent screenshots
- Adjust via browser pool size in configuration
- Exceeding limit returns error: "Browser page pool exhausted"

## Database Integration

Screenshots automatically update the `layout_snapshots` table:

```sql
INSERT INTO layout_snapshots (
  website_id,
  page_path,
  s3_key,
  hash,
  doc_width,
  doc_height,
  updated_at
) VALUES (...)
ON CONFLICT (website_id, page_path) 
DO UPDATE SET ...
```

This integration enables:
- Automatic heatmap canvas refresh with captured screenshots
- Hash-based deduplication (avoids re-storing identical screenshots)
- Dimension metadata for proper overlay alignment

## Deduplication in Practice

### When Deduplication Helps

1. **Initial Dashboard Setup**: Users often capture screenshots from dashboard multiple times
   - First capture via html2canvas
   - Later use Playwright API to refresh
   - Identical screenshots are detected and not re-uploaded

2. **Batch Capture Jobs**: Running scheduled batch captures
   - Many pages haven't changed since last capture
   - Deduplication prevents redundant S3 uploads
   - Saves bandwidth and storage costs

3. **Concurrent Requests**: Two requests for same page at same time
   - First completes and stores screenshot
   - Second detects matching hash, reuses it
   - Avoids duplicate work

### When to Use `force: true`

```typescript
// Periodic refresh job - refresh all page screenshots weekly
const refreshAll = async () => {
  for (const pagePath of ALL_PAGES) {
    await capture({
      page_url: buildUrl(pagePath),
      page_path: pagePath,
      force: true  // Always capture fresh, don't check existing
    });
  }
};
```

Use `force: true` when:
- Running periodic refresh jobs (daily, weekly)
- Detecting design/layout changes
- Testing regression detection
- Ensuring no stale screenshots

### When to Use `check_only: true`

```typescript
// Audit: which pages have screenshots?
const coverage = async () => {
  const results = [];
  for (const pagePath of ALL_PAGES) {
    const resp = await fetch(..., {
      body: JSON.stringify({
        page_path: pagePath,
        check_only: true  // Fast DB check, no capture
      })
    });
    const data = await resp.json();
    results.push({
      pagePath,
      hasScreenshot: data.data !== null
    });
  }
  return results;
};
```

Use `check_only: true` when:
- Auditing screenshot coverage
- Checking if page needs capture
- Validating setup without captures
- Fast metadata queries

## Troubleshooting

### "Failed to launch browser"
- Ensure Playwright Chromium is installed: `bun install`
- Check memory and disk space
- Verify `@playwright/browser-chromium` package availability

### "Invalid URL" error
- Verify the `page_url` is a complete, valid HTTP(S) URL
- Check that the URL is accessible from the server
- URL must be: `https://example.com/path` (not just `/path`)

### "Timeout waiting for network idle"
- Increase `timeoutMs` in request (up to 60000ms)
- Page may have long-running requests or service workers
- Try setting `wait_for_selector` to a specific content element

### "Screenshot is not a valid JPEG"
- Usually indicates Playwright crashed or failed
- Check server logs for browser process errors
- Verify sufficient memory available

### "Browser page pool exhausted"
- Too many concurrent screenshot requests
- Wait before sending more requests
- Increase browser pool size if needed
- Consider implementing client-side request throttling

## Security

### URL Validation
- URLs are validated as valid HTTP/HTTPS URLs
- Local IPs (127.0.0.1, localhost) are allowed for development
- Consider implementing domain whitelist for production

### Access Control
- All endpoints require authentication (JWT token)
- User must be owner or member of the website
- Screenshots stored with site-specific S3 keys

### Storage
- Screenshots are JPEG files only (validated by magic bytes)
- Stored in S3 with site-specific keys
- Support for S3 encryption at rest (S3-side)

## Future Enhancements

- [ ] Custom header injection for authenticated page capture
- [ ] Screenshot comparison/diff detection
- [ ] Automatic retry on failure
- [ ] Screenshot caching/deduplication
- [ ] Scheduled screenshot jobs
- [ ] Performance metrics per screenshot
- [ ] PDF export support
- [ ] Mobile device emulation profiles
- [ ] Visual regression detection

## API Reference

See [heatmaps.ts](./routes/heatmaps.ts) routes for complete implementation.

### Service Functions

- `captureHeatmapScreenshot(websiteParam, request, opts)` - Single screenshot
- `batchCaptureHeatmapScreenshots(websiteParam, requests, opts)` - Batch processing

### Library Functions

- `captureWebPageScreenshot(options)` - Core capture logic
- `captureAndStoreScreenshot(url, bucket, siteId, pagePath, options)` - Capture + store
- `getBrowser()` - Get or create browser instance
- `createScreenshotPage()` - Create new page with pool management
- `shutdownPlaywrightBrowser()` - Graceful shutdown

## Debugging

Enable debug logging:
```bash
DEBUG=playwright:* bun run index.ts
```

Monitor browser pool:
```typescript
import { getActivePagesCount } from './lib/playwright-browser';
console.log('Active pages:', getActivePagesCount());
```

## License

Same as Seentics Enterprise.
