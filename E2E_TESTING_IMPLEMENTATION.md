# 🎯 E2E Automation Testing - Iframe Sandbox Implementation

## Overview

The automation builder now features **live end-to-end testing** using an isolated iframe sandbox. When you click "Test Automation", a modal opens with a real browser environment where your automation actually executes - showing modals, banners, and capturing all events in real-time.

---

## 🎬 How It Works

### **User Flow**

```
1. User builds automation (trigger + conditions + actions)
2. Clicks "Test Automation" button
3. Iframe sandbox modal opens
4. Test page loads in iframe
5. User clicks "Run Test"
6. Automation executes step-by-step:
   ├─ Trigger evaluation
   ├─ Condition checks
   └─ Action execution (REAL UI rendering)
7. Execution log shows each step with status
8. User sees actual modals/banners appear
```

### **Architecture**

```
┌─────────────────────────────────────────────┐
│  Builder Page (Parent Window)              │
│  ┌───────────────────────────────────────┐ │
│  │ BuilderToolbar                        │ │
│  │  [Test Automation] ← Click here       │ │
│  └───────────────────────────────────────┘ │
│                  ↓                          │
│  ┌───────────────────────────────────────┐ │
│  │ AutomationTestSandbox Modal          │ │
│  │ ┌─────────────┬───────────────────┐  │ │
│  │ │ Exec Log    │ Iframe Preview    │  │ │
│  │ │ ✅ Trigger  │ ┌───────────────┐ │  │ │
│  │ │ ✅ Cond 1   │ │  Test Page    │ │  │ │
│  │ │ ⏳ Action   │ │  [Modal shows]│ │  │ │
│  │ │             │ └───────────────┘ │  │ │
│  │ └─────────────┴───────────────────┘  │ │
│  │  [Run Test] [Close]                  │ │
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
                   ↕
          PostMessage API
                   ↕
┌─────────────────────────────────────────────┐
│  Iframe Sandbox (Isolated Environment)     │
│  - Listens for START_AUTOMATION_TEST        │
│  - Executes automation step-by-step         │
│  - Shows actual UI (modals, banners)        │
│  - Sends EXECUTION_STEP updates            │
│  - Sends TEST_COMPLETE when done           │
└─────────────────────────────────────────────┘
```

---

## 📁 Files Created/Modified

### **New Files**

#### 1. `AutomationTestSandbox.tsx`
Full-featured modal component with:
- Split view: Execution log (left) + Iframe preview (right)
- Real-time step updates via postMessage
- Status indicators: pending, running, success, failed
- Hide/show iframe toggle
- Run Test button with loading states

#### 2. `automation-test-sandbox.html`
Standalone HTML page that:
- Loads in iframe sandbox
- Listens for automation config via postMessage
- Executes triggers, conditions, and actions
- Actually renders UI elements (modals, banners)
- Reports execution steps back to parent
- Styled test page with beautiful gradient background

#### 3. `automation-test-sandbox/route.ts`
Next.js API route that:
- Serves the test HTML page
- Sets security headers (X-Frame-Options, CSP)
- Ensures same-origin iframe loading

### **Modified Files**

#### `BuilderToolbar.tsx`
- Removed API-based testing
- Added `showTestSandbox` state
- Simplified `handleTest()` to open modal
- Passes automation config to sandbox
- Imports `AutomationTestSandbox` instead of `TestResultsModal`

---

## 🔧 Technical Implementation

### **PostMessage Communication**

#### Parent → Iframe (Start Test)
```typescript
iframeRef.current.contentWindow?.postMessage({
  type: 'START_AUTOMATION_TEST',
  automation: {
    id: 'auto_123',
    name: 'Welcome Modal',
    trigger: { type: 'pageView', config: {...} },
    conditions: [{ type: 'page_match', config: {...} }],
    actions: [{ type: 'modal', config: {...} }]
  },
  testData: {
    page_url: window.location.href,
    visitor_id: 'test_visitor_123',
    session_id: 'test_session_456',
    timestamp: '2024-02-09T10:30:00Z'
  }
}, '*');
```

#### Iframe → Parent (Execution Steps)
```typescript
window.parent.postMessage({
  type: 'EXECUTION_STEP',
  step: {
    type: 'trigger',
    name: 'Page View',
    status: 'success',
    message: 'Trigger matched!',
    timestamp: Date.now()
  }
}, '*');
```

#### Iframe → Parent (Test Complete)
```typescript
window.parent.postMessage({
  type: 'TEST_COMPLETE'
}, '*');
```

### **Execution Flow in Iframe**

```javascript
async function runTest(automation, testData) {
  // 1. Trigger Evaluation
  logStep('trigger', 'Page View', 'running', 'Checking...');
  await delay(800);
  const matched = evaluateTrigger(automation.trigger);
  logStep('trigger', 'Page View', matched ? 'success' : 'failed');
  
  if (!matched) return;
  
  // 2. Condition Evaluation
  for (const condition of automation.conditions) {
    logStep('condition', condition.name, 'running', 'Evaluating...');
    await delay(600);
    const passed = evaluateCondition(condition);
    logStep('condition', condition.name, passed ? 'success' : 'failed');
    if (!passed) return;
  }
  
  // 3. Action Execution
  for (const action of automation.actions) {
    logStep('action', action.name, 'running', 'Executing...');
    await delay(800);
    await executeAction(action); // ACTUALLY shows modal/banner
    await delay(500);
  }
  
  logStep('test', 'Complete', 'success', 'All steps passed!');
}
```

### **Action Execution (Real UI)**

```javascript
function executeAction(action) {
  switch (action.type) {
    case 'modal':
      // ACTUALLY shows modal
      document.getElementById('modal-title').textContent = action.config.title;
      document.getElementById('modal-text').textContent = action.config.content;
      document.getElementById('automation-modal').classList.add('visible');
      logStep('action', 'Modal', 'success', `Displayed: "${action.config.title}"`);
      break;
      
    case 'banner':
      // ACTUALLY shows banner
      const banner = document.getElementById('automation-banner');
      banner.textContent = action.config.content;
      banner.style.background = action.config.backgroundColor;
      banner.classList.add('visible');
      logStep('action', 'Banner', 'success', `Displayed: "${action.config.content}"`);
      break;
      
    case 'redirect':
      // Simulated (doesn't actually redirect)
      logStep('action', 'Redirect', 'success', `Would redirect to: ${action.config.url}`);
      break;
      
    case 'email':
      // Simulated (doesn't actually send)
      logStep('action', 'Email', 'success', `Would send email to: ${action.config.recipient}`);
      break;
  }
}
```

---

## 🎨 UI Features

### **Execution Log Panel**

Shows real-time progress with:
- **Type badges**: trigger, condition, action
- **Status icons**:
  - ⏳ Running (blue spinner)
  - ✅ Success (green check)
  - ❌ Failed (red X)
  - ⏸️ Pending (gray alert)
- **Messages**: Descriptive text for each step
- **Auto-scroll**: Follows latest step

### **Iframe Preview Panel**

- Full-size preview of test page
- Shows actual automation UI elements
- Toggle visibility with "Show/Hide Preview" button
- Sandbox attributes for security
- Overlay during test execution

### **Control Buttons**

- **Run Test**: Starts execution (disabled while testing)
- **Show/Hide Preview**: Toggles iframe visibility
- **Close**: Closes modal and resets state

---

## 🔒 Security Considerations

### **Iframe Sandbox Attributes**

```tsx
<iframe
  sandbox="allow-scripts allow-same-origin allow-modals"
  src="/automation-test-sandbox"
/>
```

- `allow-scripts`: Permits JavaScript execution
- `allow-same-origin`: Allows postMessage communication
- `allow-modals`: Permits alert/confirm dialogs
- **Restrictions**: No top-level navigation, no form submission

### **HTTP Headers**

```typescript
'X-Frame-Options': 'SAMEORIGIN',
'Content-Security-Policy': "frame-ancestors 'self'"
```

Ensures test page can only be embedded from same origin.

### **PostMessage Origin Validation**

In production, validate message origins:
```javascript
window.addEventListener('message', (event) => {
  // if (event.origin !== 'https://your-domain.com') return;
  // Process message...
});
```

---

## 🚀 Usage Guide

### **For Users**

1. **Build Your Automation**
   - Add 1 trigger (e.g., "Page View")
   - Add conditions (optional)
   - Add actions (e.g., "Show Modal")

2. **Open Test Sandbox**
   - Click **"Test Automation"** button
   - Modal opens with test environment

3. **Run Test**
   - Click **"Run Test"** button
   - Watch execution log for progress
   - See actual UI elements appear in iframe

4. **Review Results**
   - Green checks = steps passed
   - Red X = steps failed
   - See exactly what users will experience

5. **Iterate**
   - Close modal
   - Adjust automation
   - Test again

### **What Gets Tested**

✅ **Trigger Matching**
- Page view detection
- Scroll depth simulation
- Time on page check
- Exit intent detection

✅ **Condition Evaluation**
- URL pattern matching
- Visit count checks
- Custom conditions

✅ **Action Execution** (REAL!)
- Modals appear with configured content
- Banners slide in with styling
- Redirects are simulated (logged only)
- Emails/webhooks are simulated (logged only)

---

## 🎯 Advantages Over API Testing

| Feature | API Testing (Old) | Iframe Sandbox (New) |
|---------|------------------|---------------------|
| **Visual Feedback** | ❌ None | ✅ See actual UI |
| **Real Execution** | ❌ Simulated | ✅ Actually renders |
| **Step-by-Step** | ✅ Yes | ✅ Yes with timing |
| **User Experience** | ❌ No preview | ✅ Full preview |
| **Safety** | ✅ No side effects | ✅ Isolated iframe |
| **Speed** | ✅ Fast (<1s) | ⚡ Medium (~3-5s) |
| **CSS Testing** | ❌ Can't test | ✅ Shows styling |
| **Real-time Log** | ❌ Only final result | ✅ Live updates |

---

## 🔮 Future Enhancements

### **Phase 2: Enhanced Testing**

1. **Custom Test Data**
   - Allow users to input custom visitor data
   - Test with specific URLs, cookies, etc.

2. **Screenshot Capture**
   - Take screenshots at each action
   - Include in test report

3. **Test History**
   - Save test results to database
   - Compare tests over time

4. **Multi-Device Testing**
   - Mobile preview mode
   - Responsive testing

### **Phase 3: Advanced Features**

1. **Real Website Testing**
   - Load user's actual website in iframe
   - Test on production pages (with CORS handling)

2. **Video Recording**
   - Record entire test execution
   - Download test video

3. **Performance Metrics**
   - Measure action execution time
   - Track resource usage

4. **Collaborative Testing**
   - Share test link with team
   - Comment on test results

---

## 🐛 Troubleshooting

### **Iframe Not Loading**

**Problem**: White screen in preview panel

**Solutions**:
- Check `/automation-test-sandbox` route exists
- Verify `automation-test-sandbox.html` in `/public/`
- Check browser console for CSP errors

### **PostMessage Not Working**

**Problem**: No execution logs appear

**Solutions**:
- Check browser console for postMessage errors
- Verify iframe `contentWindow` is accessible
- Ensure same-origin policy compliance

### **Actions Not Appearing**

**Problem**: Modals/banners don't show

**Solutions**:
- Inspect iframe DOM for elements
- Check CSS classes are applied
- Verify action config has required fields

### **Test Gets Stuck**

**Problem**: "Testing..." never completes

**Solutions**:
- Check for JavaScript errors in iframe console
- Verify TEST_COMPLETE message is sent
- Reload page and try again

---

## 📊 Comparison with Other Approaches

### **Why Iframe Sandbox?**

**✅ Chosen Approach**: Iframe with postMessage

**Alternatives Considered**:

1. **Docker Containers** 🐳
   - ❌ Too complex
   - ❌ Slow startup (~5s)
   - ❌ Infrastructure overhead

2. **Playwright/Puppeteer** 🎭
   - ❌ Requires headless browser
   - ❌ Backend complexity
   - ❌ Can't show live preview

3. **API Simulation** ⚡
   - ❌ No visual confirmation
   - ❌ Doesn't test actual rendering
   - ✅ Fast, but limited

4. **Iframe Sandbox** 🎯 **← We chose this!**
   - ✅ Real UI rendering
   - ✅ Fast (~3s)
   - ✅ Simple implementation
   - ✅ Safe isolation
   - ✅ Live preview

---

## 🎉 Summary

The iframe sandbox testing system provides:

✅ **Real end-to-end testing** with actual UI rendering  
✅ **Visual confirmation** of modals, banners, and actions  
✅ **Step-by-step execution log** with status indicators  
✅ **Safe isolation** with no side effects  
✅ **Fast execution** (~3-5 seconds)  
✅ **Great UX** with split-screen preview  
✅ **Security** via sandbox attributes and headers  

Users can now confidently test their automations with **actual visual feedback** before publishing to production! 🚀
