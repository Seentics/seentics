# Automation Dynamic Variables & Custom Nodes

Complete guide to using dynamic variables and creating custom nodes in the Seentics Analytics automation system.

## 🎯 Dynamic Variables System

### Overview
Dynamic variables allow you to insert personalized, real-time data into your automation workflows. Variables use the `{{variable_name}}` syntax and are automatically replaced with actual values at runtime.

### Variable Categories

#### 1. 👤 User Data Variables
- `{{user_id}}` - Unique user identifier
- `{{user_email}}` - User email address
- `{{user_name}}` - User's full name
- `{{user_ip}}` - User's IP address
- `{{user_country}}` - User's country (from GeoIP)
- `{{user_city}}` - User's city (from GeoIP)
- `{{user_language}}` - Browser language preference
- `{{user_timezone}}` - User's timezone

**Example Usage:**
```
Subject: Hi {{user_name}}, special offer from {{user_city}}!
Message: Dear {{user_name}}, we noticed you're from {{user_country}}...
```

#### 2. 📊 Session Data Variables
- `{{session_id}}` - Current session identifier
- `{{page_views}}` - Number of pages viewed in session
- `{{time_on_site}}` - Total time spent on site (seconds)
- `{{referrer}}` - Page that referred the user
- `{{utm_source}}` - UTM source parameter
- `{{utm_medium}}` - UTM medium parameter
- `{{utm_campaign}}` - UTM campaign parameter

**Example Usage:**
```
You've viewed {{page_views}} pages in this session!
Time on site: {{time_on_site}} seconds
Source: {{utm_source}} / {{utm_medium}}
```

#### 3. 📄 Page Data Variables
- `{{page_url}}` - Current page URL
- `{{page_title}}` - Current page title
- `{{page_path}}` - Current page path
- `{{scroll_depth}}` - Scroll depth percentage (0-100)

**Example Usage:**
```
Share this page: {{page_title}}
URL: {{page_url}}
You've scrolled {{scroll_depth}}% of the page!
```

#### 4. 📱 Device Data Variables
- `{{device_type}}` - Device type (mobile/desktop)
- `{{browser}}` - Browser user agent string
- `{{os}}` - Operating system
- `{{screen_width}}` - Screen width in pixels
- `{{screen_height}}` - Screen height in pixels

**Example Usage:**
```
Optimized for {{device_type}} on {{os}}
Screen: {{screen_width}}x{{screen_height}}
```

#### 5. 🕐 Timestamp Data Variables
- `{{timestamp}}` - Current Unix timestamp
- `{{date}}` - Current date (YYYY-MM-DD)
- `{{time}}` - Current time (HH:MM:SS)
- `{{day_of_week}}` - Day name (Monday, Tuesday, etc.)

**Example Usage:**
```
Generated on {{date}} at {{time}}
Happy {{day_of_week}}!
Order #{{timestamp}}
```

#### 6. 🎯 Funnel & Goal Data Variables
- `{{funnel_id}}` - Funnel identifier
- `{{funnel_step}}` - Current funnel step
- `{{goal_id}}` - Goal identifier
- `{{goal_value}}` - Goal value amount
- `{{conversion_value}}` - Conversion value

**Example Usage:**
```
You completed {{funnel_id}}!
Current step: {{funnel_step}}
Goal value: ${{goal_value}}
```

---

## 🔧 Using Variables in Actions

### Email Action
```
To: {{user_email}}
Subject: Hi {{user_name}}, {{page_title}} insights!
Body: 
  Dear {{user_name}},
  
  Thank you for visiting from {{user_city}}, {{user_country}}!
  You've been active for {{time_on_site}} seconds across {{page_views}} pages.
  
  Best regards,
  The Team
```

### Modal Action
```
Title: Welcome {{user_name}}!
Content: 
  Hi {{user_name}} from {{user_city}}! 👋
  
  We see you're browsing on {{device_type}}.
  You've scrolled {{scroll_depth}}% of this page.
  
  Enjoying your visit?
Button: Get Started
```

### Banner Action
```
Message: 🎉 Special offer for visitors from {{user_country}}! 
         Limited time only on {{day_of_week}}s!
```

### Notification Action
```
Title: Hey {{user_name}}!
Message: You've reached {{scroll_depth}}% scroll depth. Keep going!
```

### Webhook Action
```
URL: https://api.example.com/track
Payload:
{
  "user_id": "{{user_id}}",
  "email": "{{user_email}}",
  "country": "{{user_country}}",
  "page": "{{page_url}}",
  "timestamp": "{{timestamp}}"
}
```

---

## 🎨 Custom Nodes System

### Overview
Create your own custom triggers, conditions, and actions that integrate seamlessly with the automation builder.

### Creating a Custom Node

1. **Click "Create Custom Node"** button in the builder sidebar
2. **Fill in basic information:**
   - Node Name (e.g., "Slack Notification")
   - Category (Trigger, Condition, or Action)
   - Description
   - Icon (emoji)
   - Color (hex code)

3. **Add configuration fields:**
   - Field Name (variable name, e.g., `webhook_url`)
   - Field Label (display name, e.g., "Webhook URL")
   - Field Type (text, textarea, number, select, boolean)
   - Placeholder text
   - Options (for select type)

4. **Write execution code (optional):**
   ```javascript
   // Access config values
   const url = config.webhook_url;
   const message = config.message;
   
   // Access dynamic data
   const userName = data.user_name;
   
   // Execute custom logic
   await fetch(url, {
     method: 'POST',
     body: JSON.stringify({
       text: `${message} - ${userName}`,
       timestamp: Date.now()
     })
   });
   
   return { success: true };
   ```

### Example: Slack Notification Action

**Node Configuration:**
- **Name:** Slack Notification
- **Category:** Action
- **Icon:** 💬
- **Color:** #4A154B

**Fields:**
1. `webhook_url` (text) - "Slack Webhook URL"
2. `message` (textarea) - "Message to send"
3. `channel` (select) - "Channel" [#general, #alerts, #marketing]
4. `mention_user` (boolean) - "Mention @channel"

**Execution Code:**
```javascript
const { webhook_url, message, channel, mention_user } = config;

const slackMessage = {
  channel: channel,
  text: mention_user ? `<!channel> ${message}` : message,
  username: "Automation Bot",
  icon_emoji: ":robot_face:"
};

const response = await fetch(webhook_url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(slackMessage)
});

return { 
  success: response.ok,
  status: response.status 
};
```

### Example: Business Hours Condition

**Node Configuration:**
- **Name:** Business Hours Check
- **Category:** Condition
- **Icon:** 🕐
- **Color:** #F59E0B

**Fields:**
1. `start_hour` (number) - "Start Hour (0-23)"
2. `end_hour` (number) - "End Hour (0-23)"
3. `timezone` (text) - "Timezone"
4. `include_weekends` (boolean) - "Include Weekends"

**Execution Code:**
```javascript
const { start_hour, end_hour, timezone, include_weekends } = config;

const now = new Date();
const currentHour = now.getHours();
const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

// Check weekends
if (!include_weekends && (currentDay === 0 || currentDay === 6)) {
  return { matches: false, reason: 'Weekend' };
}

// Check business hours
const isBusinessHours = currentHour >= start_hour && currentHour < end_hour;

return { 
  matches: isBusinessHours,
  reason: isBusinessHours ? 'Within business hours' : 'Outside business hours'
};
```

### Example: Custom Event Trigger

**Node Configuration:**
- **Name:** Stripe Payment Received
- **Category:** Trigger
- **Icon:** 💳
- **Color:** #635BFF

**Fields:**
1. `minimum_amount` (number) - "Minimum Amount ($)"
2. `currency` (select) - "Currency" [USD, EUR, GBP]
3. `product_id` (text) - "Product ID (optional)"

**Execution Code:**
```javascript
// This code evaluates if the trigger condition is met
const { minimum_amount, currency, product_id } = config;
const { event_name, event_data } = data;

// Check if this is a payment event
if (event_name !== 'stripe.payment_received') {
  return { triggered: false };
}

// Validate amount
if (event_data.amount < minimum_amount) {
  return { triggered: false, reason: 'Amount too low' };
}

// Validate currency
if (event_data.currency !== currency) {
  return { triggered: false, reason: 'Currency mismatch' };
}

// Validate product if specified
if (product_id && event_data.product_id !== product_id) {
  return { triggered: false, reason: 'Product mismatch' };
}

return { 
  triggered: true,
  data: {
    amount: event_data.amount,
    customer_email: event_data.customer.email
  }
};
```

---

## 💡 Best Practices

### Variable Usage
1. **Always use fallbacks:** Server handles missing variables gracefully
2. **Test with real data:** Use the test sandbox to verify variable replacement
3. **Combine multiple variables:** Create rich, personalized messages
4. **Consider privacy:** Don't expose sensitive data in client-facing messages

### Custom Node Development
1. **Keep it simple:** Focus on one clear purpose per node
2. **Validate inputs:** Check config values before execution
3. **Handle errors:** Use try-catch and return error states
4. **Document well:** Write clear field labels and descriptions
5. **Test thoroughly:** Verify all field types and edge cases

### Performance Tips
1. **Use selective fields:** Only add fields you need
2. **Optimize execution code:** Avoid heavy computations
3. **Cache when possible:** Store frequently-used data
4. **Async operations:** Use async/await for external API calls

---

## 🔒 Security Considerations

1. **Webhook URLs:** Store sensitive URLs in environment variables
2. **API Keys:** Never hardcode API keys in execution code
3. **User Data:** Respect GDPR and user privacy preferences
4. **Validation:** Always validate and sanitize user inputs
5. **Rate Limiting:** Implement rate limits for external API calls

---

## 🚀 Advanced Examples

### Multi-step Personalized Campaign
```
Trigger: Funnel Dropoff (step: "payment")

Condition: User Country = "United States"

Action 1: Email
  To: {{user_email}}
  Subject: {{user_name}}, complete your purchase and save 10%!
  Body: Hi {{user_name}}, we noticed you left items in your cart
        on {{date}}. Use code SAVE10 before {{day_of_week}} ends!

Action 2: Custom Slack Notification
  webhook_url: [Your Slack URL]
  message: Cart abandonment: {{user_name}} from {{user_city}}
           Cart value: ${{conversion_value}}
  
Action 3: Track Event
  event_name: cart_recovery_email_sent
  properties: {
    "user_id": "{{user_id}}",
    "funnel_step": "{{funnel_step}}",
    "value": "{{conversion_value}}"
  }
```

### Time-based Re-engagement
```
Trigger: Inactivity (30 seconds)

Condition: Page Views > 3

Action: Modal
  Title: Still here, {{user_name}}? 👀
  Content: You've been exploring for {{time_on_site}} seconds!
           You're viewing this on {{day_of_week}} at {{time}}.
           
           Found what you need on {{page_title}}?
  Button: Yes, let's talk!
```

---

## 📚 Additional Resources

- [Automation Testing Guide](./AUTOMATION_TESTING.md)
- [API Documentation](./API_DOCS.md)
- [Variable System Source Code](../frontend/src/components/builder/NodeConfigModal.tsx#L48-180)
- [Custom Nodes Store](../frontend/src/stores/customNodesStore.ts)

---

**Last Updated:** January 2025
**Version:** 2.0.0
