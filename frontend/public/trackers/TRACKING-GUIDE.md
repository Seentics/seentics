# Seentics Analytics - Smart Tracking Guide

## 🎯 Philosophy: Track What Matters

Seentics uses **opt-in tracking** to avoid noise. By default, we only track:
- ✅ Pageviews (automatic)
- ✅ Scroll depth milestones: 50%, 100% (automatic)
- ✅ Form submissions (automatic)
- ❌ **NOT** every button/link click (too noisy!)

---

## 📊 Click Tracking (Opt-In)

### Method 1: Data Attributes (Recommended)

Add `data-track` or `data-track-click` to elements you want to track:

```html
<!-- Track this button -->
<button data-track>Sign Up</button>

<!-- Track with custom name -->
<button data-track="cta_hero_signup">Get Started</button>

<!-- Track links -->
<a href="/pricing" data-track-click>View Pricing</a>
```

### Method 2: CSS Classes

Add the `track-click` or `cta-button` class:

```html
<button class="btn cta-button">Buy Now</button>
<a href="/demo" class="track-click">Request Demo</a>
```

### Method 3: Manual Tracking

For complete control:

```javascript
// Track any event
seentics.analytics.track('button_clicked', {
  button_name: 'signup_hero',
  page: 'landing',
  user_type: 'visitor'
});

// Track business events
seentics.analytics.track('purchase_completed', {
  product_id: 'pro-plan',
  amount: 99.99,
  currency: 'USD'
});
```

---

## 🎯 What Should You Track?

### ✅ DO Track:
- **Call-to-Action buttons**: Sign up, Buy now, Get started
- **Form submissions**: Contact, Newsletter, Registration
- **Important navigation**: Pricing, Demos, Documentation
- **Business events**: Purchases, Upgrades, Downloads
- **Content milestones**: Read article, Watch video, Share
- **User intents**: Search queries, Filter selections

### ❌ DON'T Track:
- UI navigation tabs/accordions
- Dropdown menus
- Pagination buttons
- Close/Cancel buttons
- Every single link on the page
- Internal app navigation (unless critical)

---

## 📝 Examples

### E-commerce Site

```html
<!-- Hero CTA -->
<button data-track="hero_shop_now" class="cta">Shop Now</button>

<!-- Product Actions -->
<button data-track="add_to_cart" data-product-id="12345">Add to Cart</button>
<button data-track="buy_now" data-product-id="12345">Buy Now</button>

<!-- Checkout -->
<button data-track="checkout_complete" type="submit">Complete Purchase</button>
```

### SaaS Product

```html
<!-- Landing Page -->
<button data-track="cta_trial_start">Start Free Trial</button>
<a href="/demo" data-track="cta_request_demo">Schedule Demo</a>

<!-- Pricing Page -->
<button data-track="plan_select_pro" data-plan="pro">Select Pro Plan</button>

<!-- App Events -->
<script>
seentics.analytics.track('feature_used', {
  feature: 'export_report',
  format: 'pdf'
});
</script>
```

### Content Site

```html
<!-- Newsletter Signup -->
<button data-track="newsletter_subscribe" type="submit">Subscribe</button>

<!-- Social Sharing -->
<button data-track="share_twitter" onclick="shareOnTwitter()">Share</button>

<!-- Content Engagement -->
<script>
// Track when user reads 75% of article
if (scrollDepth > 75) {
  seentics.analytics.track('article_read', {
    article_id: '12345',
    category: 'technology'
  });
}
</script>
```

---

## 🔧 Configuration

### Disable Auto-Tracking

If you want full control:

```html
<script src="/trackers/seentics-analytics.js" 
        data-auto-track="false"></script>

<script>
// Now manually track everything
seentics.analytics.trackPageView();
</script>
```

### Custom Scroll Milestones

```javascript
// Track different scroll depths
seentics.analytics.track('scroll_depth', { 
  depth: 90,
  page: window.location.pathname 
});
```

---

## 📈 Best Practices

1. **Be Selective**: Track 10-20 key actions, not 100+ random clicks
2. **Use Meaningful Names**: `cta_signup` not `button_1`
3. **Add Context**: Include properties like `{page: 'pricing', plan: 'pro'}`
4. **Test First**: Use `data-debug="true"` and check console
5. **Goal-Oriented**: Every tracked event should map to a business goal

---

## 🎯 Setting Up Goals

Once you're tracking the right events, create goals:

1. Go to **Website Settings → Goals**
2. Click **Add Goal**
3. Choose:
   - **Event Goal**: Track custom events (e.g., `purchase_completed`)
   - **Page Goal**: Track page visits (e.g., `/thank-you`)
4. Monitor conversions in your dashboard

---

## 🔍 Debugging

Enable debug mode to see what's being tracked:

```html
<script src="/trackers/seentics-core.js" 
        data-website-id="YOUR_ID" 
        data-debug="true"></script>
```

Check your browser console for:
```
[Seentics] Page view tracked
[Seentics] Event tracked: button_clicked
```

---

## 💡 Common Issues

**Too many events showing up?**
- You're probably tracking too many UI interactions
- Only add `data-track` to important buttons/links

**Missing conversions?**
- Check if event names match your goal identifiers
- Verify tracking script is loaded (check browser console)
- Test in incognito mode to rule out ad blockers

**Scroll events too frequent?**
- We only track 50% and 100% by default
- This is intentional to reduce noise

---

## 📚 Additional Resources

- [API Documentation](../docs/api.md)
- [Security Guide](./SECURITY-QUICKREF.md)
- [Example Implementation](./example.html)

---

**Need Help?** Contact support or check our documentation at [your-docs-url]
