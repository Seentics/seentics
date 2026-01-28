'use client';

import { useState } from 'react';
import TrackerScript from './tracker-script';

export default function TrackerTestDemo() {
  const [events, setEvents] = useState<Array<{name: string, props: any, timestamp: string}>>([]);

  const trackTestEvent = (eventName: string, props: Record<string, any> = {}) => {
    if (typeof window !== 'undefined' && window.seenticsTest) {
      window.seenticsTest.trackEvent(eventName, props);
      setEvents(prev => [...prev, {
        name: eventName,
        props,
        timestamp: new Date().toLocaleTimeString()
      }]);
    }
  };

  const getTrackerInfo = () => {
    if (typeof window !== 'undefined' && window.seenticsTest) {
      const info = window.seenticsTest.getInfo();
      console.log('Tracker Info:', info);
      alert(`Tracker Info: ${JSON.stringify(info, null, 2)}`);
    }
  };

  return (
    <div className="p-6 bg-gray-50 rounded">
      {/* Load the tracker in test mode */}
      <TrackerScript testMode={true} siteId="demo-site-123" />
      
      <h2 className="text-2xl font-bold mb-4 text-gray-800">🧪 Seentics Tracker Test Demo</h2>
      
      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          This demo shows how the Seentics tracker works on localhost. 
          Open your browser console to see detailed tracking information.
        </p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => trackTestEvent('button_click', { button: 'test_button_1' })}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Track Button Click
          </button>
          
          <button
            onClick={() => trackTestEvent('form_submit', { form: 'newsletter', email: 'test@example.com' })}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Track Form Submit
          </button>
          
          <button
            onClick={() => trackTestEvent('purchase', { product: 'premium_plan', amount: 99.99 })}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Track Purchase
          </button>
          
          <button
            onClick={getTrackerInfo}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Get Tracker Info
          </button>
        </div>
      </div>

      {events.length > 0 && (
        <div className="bg-white p-4 rounded border">
          <h3 className="font-semibold mb-2">Recent Test Events:</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {events.slice(-5).map((event, index) => (
              <div key={index} className="text-sm bg-gray-100 p-2 rounded">
                <span className="font-mono text-blue-600">{event.timestamp}</span>
                {' - '}
                <span className="font-semibold">{event.name}</span>
                {Object.keys(event.props).length > 0 && (
                  <span className="text-gray-600"> - {JSON.stringify(event.props)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h4 className="font-semibold text-yellow-800 mb-2">💡 Testing Tips:</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Open browser console to see detailed tracking logs</li>
          <li>• Events are sent to localhost:8080 (make sure analytics service is running)</li>
          <li>• Test functions are available globally: <code>seenticsTest.trackEvent()</code></li>
          <li>• Pageview events are automatically tracked on route changes</li>
        </ul>
      </div>
    </div>
  );
}
