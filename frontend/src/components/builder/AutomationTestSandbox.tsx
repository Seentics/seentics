'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Play, CheckCircle2, XCircle, Loader2, AlertCircle, Eye } from 'lucide-react';

interface ExecutionStep {
  type: 'trigger' | 'condition' | 'action';
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  message?: string;
  timestamp: number;
}

interface AutomationTestSandboxProps {
  isOpen: boolean;
  onClose: () => void;
  automation: any;
  websiteId: string;
}

export function AutomationTestSandbox({ 
  isOpen, 
  onClose, 
  automation,
  websiteId 
}: AutomationTestSandboxProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [showIframe, setShowIframe] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [testComplete, setTestComplete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state
      setIsLoading(true);
      setIsTesting(false);
      setExecutionSteps([]);
      setTestComplete(false);
      setShowIframe(false);
      
      // Load iframe after a short delay
      setTimeout(() => {
        setIsLoading(false);
        setShowIframe(true);
      }, 500);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!showIframe) return;

    // Listen for messages from iframe
    const handleMessage = (event: MessageEvent) => {
      // Security: verify origin in production
      if (event.data.type === 'AUTOMATION_TEST_READY') {
        console.log('Iframe ready for testing');
      } else if (event.data.type === 'EXECUTION_STEP') {
        const step: ExecutionStep = event.data.step;
        setExecutionSteps(prev => {
          const index = prev.findIndex(s => s.name === step.name);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = step;
            return updated;
          }
          return [...prev, step];
        });
      } else if (event.data.type === 'TEST_COMPLETE') {
        setIsTesting(false);
        setTestComplete(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [showIframe]);

  const startTest = () => {
    if (!iframeRef.current) return;

    setIsTesting(true);
    setExecutionSteps([]);
    setTestComplete(false);

    // Send automation config to iframe
    iframeRef.current.contentWindow?.postMessage({
      type: 'START_AUTOMATION_TEST',
      automation: {
        id: automation.id,
        name: automation.name,
        trigger: automation.trigger || {},
        conditions: automation.conditions || [],
        actions: automation.actions || []
      },
      testData: {
        page_url: window.location.href,
        visitor_id: 'test_visitor_' + Date.now(),
        session_id: 'test_session_' + Date.now(),
        timestamp: new Date().toISOString()
      }
    }, '*');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-8" style={{ minHeight: '100vh' }}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col" style={{ height: '90vh', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Play className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Live Automation Test</h2>
              <p className="text-sm text-slate-400">Testing: {automation.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowIframe(!showIframe)}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm transition-colors flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {showIframe ? 'Hide' : 'Show'} Preview
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Execution Log */}
          <div className="w-1/3 border-r border-slate-700 bg-slate-900/50 flex flex-col">
            <div className="px-4 py-3 border-b border-slate-700">
              <h3 className="font-medium text-white">Execution Log</h3>
              <p className="text-xs text-slate-400 mt-1">
                {isTesting ? 'Testing in progress...' : testComplete ? 'Test completed' : 'Ready to test'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {executionSteps.length === 0 && !isTesting && (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-sm">No execution steps yet</p>
                  <p className="text-xs mt-2">Click "Run Test" to start</p>
                </div>
              )}

              {executionSteps.map((step, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    step.status === 'success'
                      ? 'bg-green-500/10 border-green-500/20'
                      : step.status === 'failed'
                      ? 'bg-red-500/10 border-red-500/20'
                      : step.status === 'running'
                      ? 'bg-blue-500/10 border-blue-500/20'
                      : 'bg-slate-800/50 border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {step.status === 'success' && (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    )}
                    {step.status === 'failed' && (
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    )}
                    {step.status === 'running' && (
                      <Loader2 className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5 animate-spin" />
                    )}
                    {step.status === 'pending' && (
                      <AlertCircle className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                          {step.type}
                        </span>
                        <p className="text-sm font-medium text-white truncate">
                          {step.name}
                        </p>
                      </div>
                      {step.message && (
                        <p className="text-xs text-slate-400 mt-1">{step.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isTesting && executionSteps.length === 0 && (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Initializing test...</p>
                </div>
              )}
            </div>

            {/* Start Test Button */}
            <div className="p-4 border-t border-slate-700">
              <button
                onClick={startTest}
                disabled={isTesting || isLoading}
                className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Test
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Iframe Preview */}
          <div className="flex-1 bg-slate-950 flex items-center justify-center relative">
            {isLoading && (
              <div className="text-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">Loading test environment...</p>
              </div>
            )}

            {showIframe && (
              <iframe
                ref={iframeRef}
                src="/automation-test-sandbox"
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-modals"
                title="Automation Test Sandbox"
              />
            )}

            {!showIframe && !isLoading && (
              <div className="text-center text-slate-500">
                <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Preview hidden</p>
                <p className="text-xs mt-2">Click "Show Preview" to view iframe</p>
              </div>
            )}

            {/* Overlay during test */}
            {isTesting && (
              <div className="absolute inset-0 bg-black/20 pointer-events-none" />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700 bg-slate-900/95 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            💡 This test runs in an isolated environment - no actual side effects
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
