'use client';

import React, { useState } from 'react';
import { X, Play, AlertCircle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Node, Edge } from 'reactflow';

interface ExecutionPreviewProps {
  workflow: {
    nodes: Node[];
    edges: Edge[];
  };
  onClose: () => void;
}

export const ExecutionPreview = ({ workflow, onClose }: ExecutionPreviewProps) => {
  const [testData, setTestData] = useState({
    userId: 'user_123',
    email: 'test@example.com',
    url: 'https://example.com/pricing',
    scrollDepth: 75,
    timeOnPage: 45,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<any[]>([]);

  const handleTestRun = async () => {
    setIsRunning(true);
    setExecutionLogs([]);

    // Simulate workflow execution
    const logs: any[] = [];

    // Execute trigger
    logs.push({
      id: '1',
      type: 'trigger',
      status: 'success',
      message: `Trigger matched: Page View on ${testData.url}`,
      timestamp: new Date(),
      duration: 12,
    });

    // Simulate condition check
    await new Promise((resolve) => setTimeout(resolve, 500));
    logs.push({
      id: '2',
      type: 'condition',
      status: 'success',
      message: 'Condition matched: Scroll depth > 50%',
      timestamp: new Date(),
      duration: 8,
    });

    // Simulate action
    await new Promise((resolve) => setTimeout(resolve, 500));
    logs.push({
      id: '3',
      type: 'action',
      status: 'success',
      message: 'Action executed: Sent email to test@example.com',
      timestamp: new Date(),
      duration: 234,
    });

    setExecutionLogs(logs);
    setIsRunning(false);
  };

  const totalDuration = executionLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
  const successCount = executionLogs.filter((l) => l.status === 'success').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-950 rounded shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="font-black text-xl">Test Workflow</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Execution Preview & Debugging
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Test Data Input */}
          <div className="p-8 border-b bg-slate-50/50 dark:bg-slate-900/20">
            <h3 className="font-black text-sm mb-4">Test Event Data</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black mb-2">User ID</label>
                <Input
                  value={testData.userId}
                  onChange={(e) =>
                    setTestData({ ...testData, userId: e.target.value })
                  }
                  className="rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-black mb-2">Email</label>
                <Input
                  value={testData.email}
                  onChange={(e) =>
                    setTestData({ ...testData, email: e.target.value })
                  }
                  className="rounded text-xs"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-black mb-2">Page URL</label>
                <Input
                  value={testData.url}
                  onChange={(e) =>
                    setTestData({ ...testData, url: e.target.value })
                  }
                  className="rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-black mb-2">
                  Scroll Depth (%)
                </label>
                <Input
                  type="number"
                  value={testData.scrollDepth}
                  onChange={(e) =>
                    setTestData({ ...testData, scrollDepth: parseInt(e.target.value) })
                  }
                  className="rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-black mb-2">
                  Time on Page (s)
                </label>
                <Input
                  type="number"
                  value={testData.timeOnPage}
                  onChange={(e) =>
                    setTestData({ ...testData, timeOnPage: parseInt(e.target.value) })
                  }
                  className="rounded text-xs"
                />
              </div>
            </div>
          </div>

          {/* Execution Logs */}
          <div className="p-8">
            {executionLogs.length > 0 && (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  <div className="bg-green-50 dark:bg-green-950/20 rounded p-3 border border-green-200 dark:border-green-900">
                    <div className="text-sm font-black text-green-900 dark:text-green-100">
                      {successCount}/{executionLogs.length}
                    </div>
                    <div className="text-[10px] text-green-700 dark:text-green-300 font-semibold">
                      Passed
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded p-3 border border-blue-200 dark:border-blue-900">
                    <div className="text-sm font-black text-blue-900 dark:text-blue-100">
                      {totalDuration}ms
                    </div>
                    <div className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold">
                      Total Time
                    </div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950/20 rounded p-3 border border-purple-200 dark:border-purple-900">
                    <div className="text-sm font-black text-purple-900 dark:text-purple-100">
                      {workflow.nodes.length}
                    </div>
                    <div className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold">
                      Nodes
                    </div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/20 rounded p-3 border border-amber-200 dark:border-amber-900">
                    <div className="text-sm font-black text-amber-900 dark:text-amber-100">
                      {workflow.edges.length}
                    </div>
                    <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                      Connections
                    </div>
                  </div>
                </div>

                {/* Log Timeline */}
                <h3 className="font-black text-sm mb-4">Execution Timeline</h3>
                <div className="space-y-3">
                  {executionLogs.map((log, index) => (
                    <div
                      key={log.id}
                      className="border rounded p-4 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {log.status === 'success' ? (
                            <CheckCircle2 size={20} className="text-green-600" />
                          ) : (
                            <AlertCircle size={20} className="text-red-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-black text-sm capitalize">
                              Step {index + 1}: {log.type}
                            </p>
                            <span className="text-[10px] font-bold text-muted-foreground">
                              {log.duration}ms
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {log.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {executionLogs.length === 0 && (
              <div className="flex items-center justify-center py-12 text-center">
                <div>
                  <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <Play size={32} className="text-muted-foreground" />
                  </div>
                  <p className="font-black text-slate-900 dark:text-white mb-1">
                    Ready to test
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Configure test data and click "Run Test" to see execution logs
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 dark:bg-slate-900/50 px-8 py-4 flex items-center justify-between">
          <Button variant="outline" onClick={onClose} className="rounded">
            Close
          </Button>
          <Button
            onClick={handleTestRun}
            disabled={isRunning}
            className="rounded gap-2 bg-primary text-white"
          >
            <Play size={14} />
            {isRunning ? 'Running...' : 'Run Test'}
          </Button>
        </div>
      </div>
    </div>
  );
};
