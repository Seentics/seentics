'use client';

import { X, CheckCircle2, XCircle, AlertCircle, Play } from 'lucide-react';

interface TestTriggerResult {
  matched: boolean;
  message: string;
}

interface TestConditionDetail {
  index: number;
  type: string;
  passed: boolean;
  message: string;
}

interface TestConditionsResult {
  total: number;
  passed: number;
  failed: number;
  details: TestConditionDetail[];
}

interface TestActionDetail {
  index: number;
  type: string;
  wouldRun: boolean;
  message: string;
}

interface TestActionsResult {
  total: number;
  executed: number;
  details: TestActionDetail[];
}

interface TestResult {
  success: boolean;
  message: string;
  trigger?: TestTriggerResult;
  conditions?: TestConditionsResult;
  actions?: TestActionsResult;
}

interface TestResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: TestResult | null;
  error?: string;
}

export function TestResultsModal({ isOpen, onClose, result, error }: TestResultsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Play className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Test Results</h2>
              <p className="text-sm text-slate-400">Automation execution simulation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error ? (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-400">Test Failed</p>
                <p className="text-sm text-slate-400 mt-1">{error}</p>
              </div>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* Overall Status */}
              <div className={`flex items-start gap-3 p-4 rounded-lg border ${
                result.success 
                  ? 'bg-green-500/10 border-green-500/20' 
                  : 'bg-amber-500/10 border-amber-500/20'
              }`}>
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`font-medium ${result.success ? 'text-green-400' : 'text-amber-400'}`}>
                    {result.success ? 'Test Passed' : 'Test Failed'}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">{result.message}</p>
                </div>
              </div>

              {/* Trigger */}
              {result.trigger && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white">Trigger</h3>
                    {result.trigger.matched ? (
                      <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                        Matched
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full">
                        Not Matched
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">{result.trigger.message}</p>
                </div>
              )}

              {/* Conditions */}
              {result.conditions && result.conditions.total > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-white">Conditions</h3>
                    <span className="text-xs text-slate-400">
                      {result.conditions.passed}/{result.conditions.total} passed
                    </span>
                  </div>
                  <div className="space-y-2">
                    {result.conditions.details.map((condition) => (
                      <div
                        key={condition.index}
                        className="flex items-start gap-2 text-sm"
                      >
                        {condition.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-slate-300">{condition.message}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Type: {condition.type}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {result.actions && result.actions.total > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-white">Actions</h3>
                    <span className="text-xs text-slate-400">
                      {result.actions.executed}/{result.actions.total} would execute
                    </span>
                  </div>
                  <div className="space-y-2">
                    {result.actions.details.map((action) => (
                      <div
                        key={action.index}
                        className="flex items-start gap-2 text-sm"
                      >
                        {action.wouldRun ? (
                          <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-slate-300">{action.message}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Type: {action.type}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Test Info */}
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                <p className="text-xs text-slate-400">
                  💡 This is a simulation showing what would happen if this automation were triggered.
                  No actual actions were performed.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <p>No test results available</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
