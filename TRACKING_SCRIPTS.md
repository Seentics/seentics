# Seentics Tracking Scripts - Consolidated Architecture

## Overview

The tracking system has been refactored into **3 main scripts** with a **shared core** for efficient data communication.

---

## Architecture

### Core Script (Required)
**`seentics-core.js`** - Shared foundation for all tracking

**Features:**
- Session management (visitor ID, session ID)
- Event queue and batch processing
- API communication
- Event emitter for inter-module communication
- Utility functions
- Cookie/storage management

### Module Scripts (Optional - Load as needed)

1. **`seentics-analytics.js`** - Analytics tracking
   - Pageviews
   - Custom events
   - Click tracking
   - Scroll depth
   - Time on page
   - SPA navigation

2. **`seentics-automation.js`** - Automation & UI actions
   - Automation triggers
   - Modal display
   - Banner display
   - Notification display
   - Script injection
   - Frequency control

3. **`seentics-funnels.js`** - Funnel tracking
   - Funnel step progression
   - Conversion tracking
   - Dropoff detection
   - Multi-funnel support

---

## Installation

### Basic Setup (Analytics Only)
```html
<!-- Core (required) -->
<script src="https://cdn.seentics.com/trackers/seentics-core.js" 
        data-website-id="YOUR_WEBSITE_ID"></script>

<!-- Analytics module -->
<script src="https://cdn.seentics.com/trackers/seentics-analytics.js"></script>
```

### Full Setup (All Features)
```html
<!-- Core (required) -->
<script src="https://cdn.seentics.com/trackers/seentics-core.js" 
        data-website-id="YOUR_WEBSITE_ID"
        data-debug="false"></script>

<!-- All modules -->
<script src="https://cdn.seentics.com/trackers/seentics-analytics.js"></script>
<script src="https://cdn.seentics.com/trackers/seentics-automation.js"></script>
<script src="https://cdn.seentics.com/trackers/seentics-funnels.js"></script>
```

### Custom Setup (Pick what you need)
```html
<!-- Core + Automation only -->
<script src="https://cdn.seentics.com/trackers/seentics-core.js" 
        data-website-id="YOUR_WEBSITE_ID"></script>
<script src="https://cdn.seentics.com/trackers/seentics-automation.js"></script>
```

---

## Data Sharing

All modules share data through the core:

```javascript
// Core provides shared state
SEENTICS_CORE.state = {
  visitorId: "...",
  sessionId: "...",
  lastActivity: 1234567890
}

// Modules communicate via events
SEENTICS_CORE.on('analytics:pageview', (data) => {
  // Automation can react to pageviews
  // Funnels can track funnel steps
});

SEENTICS_CORE.emit('custom:event', { data });
```

---

## API Reference

### Core API
```javascript
// Initialize manually (if not using data-website-id)
SEENTICS_CORE.init({
  websiteId: 'YOUR_WEBSITE_ID',
  debug: false
});

// Event system
SEENTICS_CORE.on('event:name', callback);
SEENTICS_CORE.emit('event:name', data);
SEENTICS_CORE.off('event:name', callback);

// Utilities
SEENTICS_CORE.utils.generateId();
SEENTICS_CORE.utils.getCookie(name);
SEENTICS_CORE.utils.setCookie(name, value, days);

// Queue
SEENTICS_CORE.queue.add(event);
SEENTICS_CORE.queue.flush();

// API
SEENTICS_CORE.api.send(endpoint, data);
```

### Analytics API
```javascript
// Track custom event
seentics.analytics.track('button_click', { 
  button: 'signup',
  location: 'header'
});

// Track pageview (auto-tracked)
seentics.analytics.trackPageView();

// Track click
seentics.analytics.trackClick(element, { custom: 'data' });

// Get metrics
seentics.analytics.getPageViewId();
seentics.analytics.getTimeOnPage(); // seconds
seentics.analytics.getScrollDepth(); // percentage
```

### Automation API
```javascript
// Show modal
seentics.automation.showModal({
  title: 'Welcome!',
  content: 'Get started with our platform',
  primaryButton: 'Get Started',
  secondaryButton: 'Learn More'
});

// Show banner
seentics.automation.showBanner({
  content: 'Special offer!',
  icon: '🎉',
  position: 'bottom',
  backgroundColor: '#4F46E5',
  textColor: '#FFFFFF',
  duration: 10
});

// Show notification
seentics.automation.showNotification({
  title: 'Success!',
  message: 'Your changes have been saved',
  type: 'success',
  position: 'top',
  duration: 5
});

// Trigger automation manually
seentics.automation.trigger('custom_event', { data });
```

### Funnel API
```javascript
// Get funnel progress
const progress = seentics.funnel.getProgress('funnel-id');
// Returns: { currentStep: 2, completedSteps: [0, 1, 2], startedAt: "..." }

// Get all funnel progress
const allProgress = seentics.funnel.getAllProgress();

// Reset funnel
seentics.funnel.reset('funnel-id'); // specific funnel
seentics.funnel.reset(); // all funnels
```

---

## Events

### Core Events
- `core:ready` - Core initialized
- `session:start` - New session started
- `queue:flushed` - Events sent to server
- `queue:error` - Queue flush failed

### Analytics Events
- `analytics:pageview` - Page viewed
- `analytics:event` - Custom event tracked

### Automation Events
- `automation:loaded` - Automations loaded
- `automation:action` - Action executed

### Funnel Events
- `funnel:loaded` - Funnels loaded
- `funnel:started` - Funnel started
- `funnel:progress` - Funnel step completed
- `funnel:completed` - Funnel conversion
- `funnel:dropoff` - User dropped off

---

## Migration from Old Scripts

### Before (Multiple Scripts)
```html
<script src="tracker.js"></script>
<script src="workflow-tracker.js"></script>
<script src="funnel-tracker.js"></script>
<script src="automation-display.js"></script>
<script src="automation-ui-actions.js"></script>
```

### After (Consolidated)
```html
<script src="seentics-core.js" data-website-id="YOUR_ID"></script>
<script src="seentics-analytics.js"></script>
<script src="seentics-automation.js"></script>
<script src="seentics-funnels.js"></script>
```

**Benefits:**
- ✅ Reduced file count (5+ → 4)
- ✅ Shared state and utilities
- ✅ Better data communication
- ✅ Smaller total size
- ✅ Load only what you need
- ✅ No duplicate code

---

## File Sizes

| Script | Size | Purpose |
|--------|------|---------|
| `seentics-core.js` | ~6KB | Required foundation |
| `seentics-analytics.js` | ~4KB | Analytics tracking |
| `seentics-automation.js` | ~8KB | Automation + UI |
| `seentics-funnels.js` | ~5KB | Funnel tracking |
| **Total (all)** | **~23KB** | Full suite |
| **Min (analytics only)** | **~10KB** | Core + Analytics |

---

## Example Usage

### E-commerce Site
```html
<!-- Track analytics + funnels (checkout flow) -->
<script src="seentics-core.js" data-website-id="abc123"></script>
<script src="seentics-analytics.js"></script>
<script src="seentics-funnels.js"></script>

<script>
  // Track add to cart
  document.querySelector('.add-to-cart').addEventListener('click', () => {
    seentics.analytics.track('add_to_cart', {
      product_id: '123',
      price: 29.99
    });
  });
</script>
```

### Marketing Site
```html
<!-- Track analytics + show automations (exit intent, etc) -->
<script src="seentics-core.js" data-website-id="abc123"></script>
<script src="seentics-analytics.js"></script>
<script src="seentics-automation.js"></script>
```

### SaaS Dashboard
```html
<!-- Track analytics only -->
<script src="seentics-core.js" data-website-id="abc123"></script>
<script src="seentics-analytics.js"></script>

<script>
  // Track feature usage
  seentics.analytics.track('feature_used', {
    feature: 'export_data',
    format: 'csv'
  });
</script>
```

---

## Summary

**Old Structure:** 5+ separate scripts with duplicate code
**New Structure:** 1 core + 3 optional modules

**Advantages:**
- Shared session/visitor management
- Event-driven communication
- Load only what you need
- Smaller total size
- Better maintainability
- Cleaner API

All scripts work together seamlessly through the shared core! 🚀
