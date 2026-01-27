#!/bin/bash

# Test Modal, Banner, and Notification Actions

echo "=== Testing UI Actions ==="
echo ""

# Create a simple HTML test page
cat > /tmp/seentics-ui-test.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>Seentics UI Actions Test</title>
  <script src="http://localhost:3000/trackers/shared-constants.js"></script>
  <script src="http://localhost:3000/trackers/automation-ui-actions.js"></script>
</head>
<body style="font-family: Arial, sans-serif; padding: 40px;">
  <h1>Seentics UI Actions Test</h1>
  
  <div style="display: flex; gap: 20px; margin: 20px 0;">
    <button onclick="testModal()" style="padding: 12px 24px; background: #4F46E5; color: white; border: none; border-radius: 8px; cursor: pointer;">
      Show Modal
    </button>
    
    <button onclick="testBanner()" style="padding: 12px 24px; background: #10B981; color: white; border: none; border-radius: 8px; cursor: pointer;">
      Show Banner
    </button>
    
    <button onclick="testNotification()" style="padding: 12px 24px; background: #F59E0B; color: white; border: none; border-radius: 8px; cursor: pointer;">
      Show Notification
    </button>
    
    <button onclick="testCustomModal()" style="padding: 12px 24px; background: #8B5CF6; color: white; border: none; border-radius: 8px; cursor: pointer;">
      Custom Modal
    </button>
  </div>

  <script>
    function testModal() {
      seentics.showModal({
        title: 'Welcome to Seentics!',
        content: 'This is a beautiful modal with default styling. Click confirm to see the callback in action.',
        primaryButton: 'Confirm',
        secondaryButton: 'Cancel',
        onPrimaryClick: () => {
          alert('Primary button clicked!');
        },
        onClose: () => {
          console.log('Modal closed');
        }
      });
    }

    function testBanner() {
      seentics.showBanner({
        content: '🎉 Special offer: Get 20% off your first purchase! Use code WELCOME20',
        icon: '🎁',
        position: 'bottom',
        backgroundColor: '#4F46E5',
        textColor: '#FFFFFF',
        closeButton: true,
        duration: 10
      });
    }

    function testNotification() {
      seentics.showNotification({
        title: 'Success!',
        message: 'Your changes have been saved successfully.',
        type: 'success',
        position: 'top',
        duration: 5
      });
    }

    function testCustomModal() {
      seentics.showModal({
        customHtml: `
          <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 999999;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 20px; color: white; max-width: 400px; text-align: center;">
              <h2 style="margin: 0 0 20px; font-size: 28px;">🚀 Custom Modal</h2>
              <p style="margin: 0 0 30px; opacity: 0.9;">This modal uses custom HTML and CSS!</p>
              <button data-seentics-close style="background: white; color: #667eea; padding: 12px 32px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
                Close
              </button>
            </div>
          </div>
        `,
        customCss: '',
        customJs: 'console.log("Custom modal loaded!");'
      });
    }
  </script>
</body>
</html>
EOF

echo "✅ Created test HTML file: /tmp/seentics-ui-test.html"
echo ""
echo "To test:"
echo "1. Make sure your frontend dev server is running (npm run dev)"
echo "2. Open: file:///tmp/seentics-ui-test.html in your browser"
echo "3. Click the buttons to test each UI action"
echo ""
echo "Expected results:"
echo "  - Modal: Shows centered modal with title, content, and buttons"
echo "  - Banner: Shows banner at bottom with message and close button"
echo "  - Notification: Shows notification at top-right with success icon"
echo "  - Custom Modal: Shows gradient modal with custom styling"
