'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Play, CheckCircle2, Loader2, TrendingUp, Target, Eye, ArrowRight } from 'lucide-react';

interface FunnelStep {
  id: string;
  name: string;
  type: 'page_view' | 'event';
  value: string;
  status: 'pending' | 'current' | 'completed' | 'dropped';
  timestamp?: number;
}

interface FunnelTestSandboxProps {
  isOpen: boolean;
  onClose: () => void;
  funnel: {
    name: string;
    steps: any[];
  };
  websiteId: string;
}

export function FunnelTestSandbox({ 
  isOpen, 
  onClose, 
  funnel,
  websiteId 
}: FunnelTestSandboxProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testSteps, setTestSteps] = useState<FunnelStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [showIframe, setShowIframe] = useState(false);
  const [conversionRate, setConversionRate] = useState(0);
  const [dropoffStep, setDropoffStep] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state
      setIsLoading(true);
      setIsTesting(false);
      setCurrentStepIndex(-1);
      setShowIframe(false);
      setConversionRate(0);
      setDropoffStep(null);
      
      // Initialize test steps
      const steps: FunnelStep[] = funnel.steps.map((step, index) => ({
        id: step.id || `step_${index}`,
        name: step.name,
        type: step.type,
        value: step.value,
        status: 'pending'
      }));
      setTestSteps(steps);
      
      // Load iframe after a short delay
      setTimeout(() => {
        setIsLoading(false);
        setShowIframe(true);
      }, 500);
    }
  }, [isOpen, funnel]);

  useEffect(() => {
    if (!showIframe) return;

    // Listen for messages from iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'FUNNEL_TEST_READY') {
        console.log('Iframe ready for funnel testing');
      } else if (event.data.type === 'STEP_PROGRESSED') {
        const { stepIndex } = event.data;
        setCurrentStepIndex(stepIndex);
        updateStepStatus(stepIndex, 'completed');
        if (stepIndex < testSteps.length - 1) {
          updateStepStatus(stepIndex + 1, 'current');
        }
      } else if (event.data.type === 'STEP_DROPPED') {
        const { stepIndex } = event.data;
        setDropoffStep(stepIndex);
        setIsTesting(false);
      } else if (event.data.type === 'FUNNEL_COMPLETE') {
        setIsTesting(false);
        setConversionRate(100);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [showIframe, testSteps]);

  const updateStepStatus = (index: number, status: FunnelStep['status']) => {
    setTestSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, status, timestamp: Date.now() } : step
    ));
  };

  const startTest = () => {
    if (!iframeRef.current) return;

    setIsTesting(true);
    setCurrentStepIndex(-1);
    setConversionRate(0);
    setDropoffStep(null);
    
    // Reset all steps
    setTestSteps(prev => prev.map(step => ({...step, status: 'pending' as const})));

    // Send funnel config to iframe
    iframeRef.current.contentWindow?.postMessage({
      type: 'START_FUNNEL_TEST',
      funnel: {
        name: funnel.name,
        steps: funnel.steps.map((step, index) => ({
          id: step.id || `step_${index}`,
          name: step.name,
          type: step.type,
          value: step.value,
          order: index
        }))
      }
    }, '*');
  };

  if (!isOpen) return null;

  const completedSteps = testSteps.filter(s => s.status === 'completed').length;
  const currentConversionRate = testSteps.length > 0 ? Math.round((completedSteps / testSteps.length) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-8" style={{ minHeight: '100vh' }}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col" style={{ height: '90vh', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Funnel Flow Test</h2>
              <p className="text-sm text-slate-400">Testing: {funnel.name}</p>
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
          {/* Left: Funnel Steps Progress */}
          <div className="w-1/3 border-r border-slate-700 bg-slate-900/50 flex flex-col">
            <div className="px-4 py-3 border-b border-slate-700">
              <h3 className="font-medium text-white">Funnel Progress</h3>
              <p className="text-xs text-slate-400 mt-1">
                {isTesting ? 'Test in progress...' : 'Ready to test'}
              </p>
            </div>

            {/* Conversion Rate */}
            <div className="px-4 py-4 border-b border-slate-700 bg-emerald-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">Conversion Rate</span>
                <span className="text-2xl font-bold text-emerald-500">{currentConversionRate}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${currentConversionRate}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {completedSteps} of {testSteps.length} steps completed
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {testSteps.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-sm">No funnel steps defined</p>
                  <p className="text-xs mt-2">Add steps to test the funnel</p>
                </div>
              )}

              {testSteps.map((step, index) => (
                <div key={step.id} className="relative">
                  {index > 0 && (
                    <div className="absolute left-5 -top-3 w-0.5 h-3 bg-slate-700" />
                  )}
                  <div
                    className={`p-3 rounded-lg border transition-all ${
                      step.status === 'completed'
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : step.status === 'current'
                        ? 'bg-blue-500/10 border-blue-500/30 ring-2 ring-blue-500/20'
                        : step.status === 'dropped'
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-slate-800/50 border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${
                        step.status === 'completed'
                          ? 'bg-emerald-500 text-white'
                          : step.status === 'current'
                          ? 'bg-blue-500 text-white'
                          : step.status === 'dropped'
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {step.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : step.status === 'current' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                            {step.type === 'page_view' ? 'Page' : 'Event'}
                          </span>
                          <p className="text-sm font-medium text-white truncate">
                            {step.name}
                          </p>
                        </div>
                        <p className="text-xs text-slate-400 truncate">{step.value || 'Not configured'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Start Test Button */}
            <div className="p-4 border-t border-slate-700">
              <button
                onClick={startTest}
                disabled={isTesting || isLoading || testSteps.length < 2}
                className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testing Flow...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    {testSteps.length < 2 ? 'Need 2+ Steps' : 'Run Funnel Test'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Iframe Preview */}
          <div className="flex-1 bg-slate-950 flex items-center justify-center relative">
            {isLoading && (
              <div className="text-center">
                <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">Loading test environment...</p>
              </div>
            )}

            {showIframe && (
              <iframe
                ref={iframeRef}
                src="/funnel-test-sandbox"
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-modals"
                title="Funnel Test Sandbox"
              />
            )}

            {!showIframe && !isLoading && (
              <div className="text-center text-slate-500">
                <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Preview hidden</p>
                <p className="text-xs mt-2">Click "Show Preview" to view simulation</p>
              </div>
            )}

            {/* Overlay during test */}
            {isTesting && (
              <div className="absolute inset-0 bg-black/10 pointer-events-none" />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700 bg-slate-900/95 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            💡 Simulated test - tracks user progression through your funnel steps
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
