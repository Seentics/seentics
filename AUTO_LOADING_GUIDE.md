# Seentics Tracking Script - Auto-Loading Guide

## How It Works

The new consolidated tracking system uses **auto-loading** to simplify installation.

---

## Single Script Installation

### Basic (Recommended)
```html
<!-- Loads core + all modules (analytics, automation, funnels) -->
<script async src="https://cdn.seentics.com/trackers/seentics-core.js" 
        data-website-id="YOUR_WEBSITE_ID"></script>
```

This **single line** automatically loads:
- ✅ Core (session management, API, queue)
- ✅ Analytics module
- ✅ Automation module (modals, banners, notifications)
- ✅ Funnels module

---

## Custom Module Loading

### Load Specific Modules Only

If you only want certain features, use `data-auto-load`:

```html
<!-- Analytics only -->
<script async src="https://cdn.seentics.com/trackers/seentics-core.js" 
        data-website-id="YOUR_WEBSITE_ID"
        data-auto-load="analytics"></script>

<!-- Analytics + Automation -->
<script async src="https://cdn.seentics.com/trackers/seentics-core.js" 
        data-website-id="YOUR_WEBSITE_ID"
        data-auto-load="analytics,automation"></script>

<!-- All modules (explicit) -->
<script async src="https://cdn.seentics.com/trackers/seentics-core.js" 
        data-website-id="YOUR_WEBSITE_ID"
        data-auto-load="analytics,automation,funnels"></script>
```

### Manual Loading (No Auto-Load)

If you want full control:

```html
<!-- Core only (no auto-load) -->
<script async src="https://cdn.seentics.com/trackers/seentics-core.js" 
        data-website-id="YOUR_WEBSITE_ID"
        data-auto-load=""></script>

<!-- Then manually load what you need -->
<script async src="https://cdn.seentics.com/trackers/seentics-analytics.js"></script>
<script async src="https://cdn.seentics.com/trackers/seentics-automation.js"></script>
```

---

## How Auto-Loading Works

1. **Core script loads** and initializes
2. **Reads `data-auto-load` attribute** (defaults to all modules)
3. **Dynamically injects script tags** for enabled modules
4. **Modules load asynchronously** and connect to core
5. **All modules share** visitor ID, session ID, and event queue

### Code Flow

```javascript
// In seentics-core.js
const script = document.currentScript;
const websiteId = script.getAttribute('data-website-id');
const autoLoad = script.getAttribute('data-auto-load');

// Parse modules to load
const modules = autoLoad ? autoLoad.split(',') : ['analytics', 'automation', 'funnels'];

// Auto-inject module scripts
modules.forEach(module => {
  const moduleScript = document.createElement('script');
  moduleScript.src = `/trackers/seentics-${module}.js`;
  moduleScript.async = true;
  document.head.appendChild(moduleScript);
});
```

---

## Data Sharing Between Modules

All modules communicate through the core's event system:

```javascript
// Core emits events
SEENTICS_CORE.emit('analytics:pageview', { url, path, title });

// Automation listens and reacts
SEENTICS_CORE.on('analytics:pageview', (data) => {
  // Check if automation should trigger
  evaluateTriggers('pageview', data);
});

// Funnels listen and track
SEENTICS_CORE.on('analytics:pageview', (data) => {
  // Check if this is a funnel step
  processFunnelStep('pageview', data);
});
```

### Shared State

```javascript
// All modules access the same state
SEENTICS_CORE.state = {
  visitorId: "abc-123",      // Shared across all modules
  sessionId: "xyz-789",      // Shared across all modules
  eventQueue: [...],         // Shared event queue
  lastActivity: 1234567890   // Shared activity tracking
}
```

---

## Benefits of Auto-Loading

✅ **Single Script Tag** - One line to install everything
✅ **Automatic Updates** - Modules stay in sync
✅ **Shared State** - All modules use same visitor/session
✅ **Efficient Loading** - Modules load in parallel
✅ **Flexible** - Choose which modules to load
✅ **No Conflicts** - Modules communicate through core

---

## File Sizes

| Configuration | Scripts Loaded | Total Size |
|---------------|----------------|------------|
| Core only | 1 file | ~7KB |
| Core + Analytics | 2 files | ~11KB |
| Core + Automation | 2 files | ~18KB |
| Core + All modules | 4 files | ~28KB |

All sizes are **uncompressed**. With gzip, expect ~30-40% smaller.

---

## Debug Mode

Enable debug mode to see what's loading:

```html
<script async src="https://cdn.seentics.com/trackers/seentics-core.js" 
        data-website-id="YOUR_WEBSITE_ID"
        data-debug="true"></script>
```

Console output:
```
[Seentics] Core initialized
[Seentics] Loading analytics module...
[Seentics] Loading automation module...
[Seentics] Loading funnels module...
✅ Seentics Core Ready
📊 Analytics module loaded
🎯 Automation module loaded
🎯 Funnels module loaded
```

---

## Migration from Old Scripts

### Before (Multiple Scripts)
```html
<script src="/trackers/tracker.js" data-site-id="123"></script>
<script src="/trackers/workflow-tracker.js"></script>
<script src="/trackers/funnel-tracker.js"></script>
```

### After (Single Script)
```html
<script async src="/trackers/seentics-core.js" data-website-id="123"></script>
```

That's it! Everything auto-loads. 🚀

---

## Summary

**Default behavior:** One script tag loads everything
**Custom loading:** Use `data-auto-load` to choose modules
**Manual control:** Set `data-auto-load=""` and load modules yourself
**Data sharing:** All modules communicate through core events

The auto-loading system makes installation simple while keeping the architecture modular and efficient!
