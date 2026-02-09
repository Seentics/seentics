# Automation Testing System - Implementation Guide

## Overview

The test button now performs **real automation testing** instead of just simulating a delay. It validates the workflow structure, sends test data to the backend, and displays detailed results in a beautiful modal.

---

## How It Works

### 1. **Frontend Testing Flow**

When you click the **Test** button in the builder toolbar:

1. **Validates workflow** - Checks for 1 trigger and at least 1 action
2. **Prepares test payload** - Extracts trigger, conditions, and actions from workflow nodes
3. **Sends to backend** - Makes POST request to `/api/automations/test`
4. **Displays results** - Shows detailed modal with trigger matching, condition evaluation, and action execution status

### 2. **Backend Testing Logic**

The backend receives the test payload and:

1. **Validates structure** - Ensures automation has required components
2. **Evaluates trigger** - Simulates trigger matching (would it activate?)
3. **Checks conditions** - Evaluates each condition with test data
4. **Simulates actions** - Determines which actions would execute
5. **Returns detailed results** - Provides pass/fail status with explanations

---

## What Gets Tested

### ✅ **Trigger Validation**
- Checks if the trigger would match with the test data
- Example: For "Page View" trigger, validates page URL pattern

### ✅ **Condition Evaluation**
- Tests each condition sequentially
- Common condition types:
  - `page_match` - URL pattern matching
  - `visit_count` - Number of visits
  - `time_on_page` - Duration on page
  - `scroll_depth` - Scroll percentage
- Returns pass/fail for each condition

### ✅ **Action Simulation**
- Lists all actions that **would execute** if conditions pass
- Does NOT actually perform actions (safe testing)
- Shows action types: modals, banners, redirects, webhooks, etc.

---

## Test Results Modal

The modal displays:

- **Overall Status** - Green (passed) or Amber (failed)
- **Trigger Section** - Whether trigger matched
- **Conditions Section** - Pass/fail status for each condition
- **Actions Section** - Which actions would execute
- **Summary Message** - Clear explanation of results

---

## API Endpoint

```
POST /api/automations/test
```

**Request Body:**
```json
{
  "automation": {
    "id": "automation_123",
    "name": "Welcome Modal",
    "trigger": {
      "type": "pageView",
      "config": {
        "page": "/",
        "pattern": "/"
      }
    },
    "conditions": [
      {
        "type": "page_match",
        "config": {
          "pattern": "/"
        }
      }
    ],
    "actions": [
      {
        "type": "modal",
        "config": {
          "title": "Welcome!",
          "content": "Thanks for visiting"
        }
      }
    ]
  },
  "testData": {
    "page_url": "https://example.com/",
    "visitor_id": "test_visitor_123",
    "session_id": "test_session_456",
    "timestamp": "2024-02-09T10:30:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test execution completed",
  "trigger": {
    "matched": true,
    "message": "Trigger 'pageView' would be activated"
  },
  "conditions": {
    "total": 1,
    "passed": 1,
    "failed": 0,
    "details": [
      {
        "index": 1,
        "type": "page_match",
        "passed": true,
        "message": "Condition 1: page_match"
      }
    ]
  },
  "actions": {
    "total": 1,
    "executed": 1,
    "details": [
      {
        "index": 1,
        "type": "modal",
        "wouldRun": true,
        "message": "Action 1: modal would execute"
      }
    ]
  }
}
```

---

## Code Files Modified

### Frontend
1. **`frontend/src/stores/automationStore.ts`**
   - Added real `testAutomation()` implementation
   - Validates workflow structure
   - Makes API call to `/api/automations/test`

2. **`frontend/src/components/builder/BuilderToolbar.tsx`**
   - Updated `handleTest()` to call real API
   - Added state for modal: `showTestResults`, `testResult`, `testError`
   - Imported `TestResultsModal`
   - Shows modal instead of alerts

3. **`frontend/src/components/builder/TestResultsModal.tsx`** *(NEW)*
   - Beautiful modal component
   - Displays trigger, conditions, and actions results
   - Color-coded pass/fail indicators
   - Detailed breakdown of each test step

### Backend
1. **`backend/internal/modules/automations/services/service.go`**
   - Added `TestAutomation()` method
   - Added `evaluateTestCondition()` helper
   - Simulates condition evaluation logic

2. **`backend/internal/modules/automations/models/automation.go`**
   - Added test result models:
     - `TestAutomationResult`
     - `TestTriggerResult`
     - `TestConditionsResult`
     - `TestActionsResult`
     - `TestAutomationRequest`

3. **`backend/internal/modules/automations/handlers/handler.go`**
   - Added `TestAutomation()` handler
   - Converts request to automation model
   - Calls service layer for testing

4. **`backend/cmd/api/main.go`**
   - Added route: `POST /api/automations/test`

---

## Usage Example

### Building a Workflow
1. Add 1 **Trigger** (e.g., "Page View on /")
2. Add **Conditions** (optional, e.g., "First Visit")
3. Add **Actions** (e.g., "Show Welcome Modal")

### Testing
1. Click **Test** button in toolbar
2. Wait for API call (shows "Testing..." state)
3. View detailed results in modal:
   - ✅ Trigger matched
   - ✅ All conditions passed (1/1)
   - ✅ 1 action would execute

### Interpreting Results
- **Green Badge** = Test passed, automation would run
- **Amber Badge** = Test failed, conditions not met
- **Red Badge** = Error occurred during testing

---

## Future Enhancements

### 1. **Custom Test Data**
Allow users to provide custom test data:
```typescript
{
  page_url: "/checkout",
  visitor_id: "real_visitor_123",
  custom_properties: {
    cart_value: 150,
    items_count: 3
  }
}
```

### 2. **Real Action Execution** (Optional)
Add a "Run for Real" mode that actually executes actions:
- Send test emails
- Trigger test webhooks
- Show actual modals in preview

### 3. **Historical Test Results**
Store test executions in database for:
- Test history tracking
- Success rate analytics
- Debugging failed tests

### 4. **Advanced Condition Testing**
Improve condition evaluation with:
- Regex pattern matching for URLs
- Time-based condition simulation
- User behavior prediction

### 5. **Test Data Presets**
Provide common test scenarios:
- "First-time visitor"
- "Returning customer"
- "High-value cart"
- "Exit intent"

---

## Safety Notes

⚠️ **Important**: The test endpoint does **NOT** execute actual actions. It only simulates what would happen. This ensures:

- No emails are sent during testing
- No webhooks are triggered
- No data is modified
- No side effects occur

This makes testing completely safe and can be run unlimited times without consequences.

---

## Troubleshooting

### "Test Failed" Error
- Check that trigger has required configuration
- Verify conditions have valid config values
- Ensure actions have necessary properties

### Backend Connection Failed
- Verify backend is running
- Check API endpoint: `/api/automations/test`
- Look for CORS issues in browser console

### Conditions Always Fail
- Current implementation uses simplified evaluation
- Enhance `evaluateTestCondition()` for real pattern matching
- Add more robust condition logic per type

---

## Summary

The testing system is now **fully functional** and provides:

✅ Real API testing with backend validation  
✅ Detailed results in beautiful modal UI  
✅ Safe simulation without side effects  
✅ Clear feedback on what would happen  
✅ Foundation for future enhancements  

Users can now confidently test their automations before publishing!
