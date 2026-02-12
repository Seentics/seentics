
'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Terminal, RefreshCw } from 'lucide-react';
import { getWorkflow, type Workflow } from '@/lib/workflow-api';
import Script from 'next/script';


// A simple log viewer component
function LogViewer({ logs, clearLogs, onRestart }: { logs: string[], clearLogs: () => void, onRestart: () => void }) {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-gray-900 text-white font-mono p-4 rounded shadow-inner h-64 flex flex-col">
      <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-green-400" />
          <h3 className="text-lg font-semibold">Workflow Logs</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onRestart}><RefreshCw className="mr-2 h-4 w-4" /> Restart</Button>
          <Button variant="ghost" size="sm" onClick={clearLogs}>Clear</Button>
        </div>
      </div>
      <div ref={logContainerRef} className="space-y-1 text-sm flex-grow overflow-y-auto">
        {logs.map((log, index) => (
          <p key={index} className="whitespace-pre-wrap">{`[${new Date().toLocaleTimeString()}] ${log}`}</p>
        ))}
        {logs.length === 0 && <p className="text-gray-500">Waiting for events...</p>}
      </div>
    </div>
  )
}

export default function PreviewPage() {
  const params = useParams();
  const id = params.id as string;
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [previewKey, setPreviewKey] = useState(Date.now()); // Used to force-reload the tracker
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const highlightSelector = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('highlightSelector') : null;

  const restartPreview = () => {
    // Clear session storage specific to the preview
    sessionStorage.removeItem(`seentics_preview_returning`);
    sessionStorage.removeItem(`seentics_preview_visitor_id`);
    setLogs([]);
    setPreviewKey(Date.now()); // Change key to remount Script and re-run effects
  };

  useEffect(() => {
    // This function will be called by the tracker script to log messages
    (window as any).logToPreviewer = (message: string) => {
      setLogs(prevLogs => [...prevLogs, message]);
    };

    const fetchWorkflow = async () => {
      setIsLoading(true);
      try {
        const fetchedWorkflow = await getWorkflow(id);
        if (fetchedWorkflow) {
          // Force Active status in preview context so triggers fire regardless of stored status
          const previewWorkflow = { ...fetchedWorkflow, status: 'Active' } as typeof fetchedWorkflow;
          setWorkflow(previewWorkflow);
          // Inject the single workflow into a global object so workflow-tracker can find it
          (window as any).__SEENTICS_PREVIEW_WORKFLOW = previewWorkflow;
        } else {
          setLogs(prev => [...prev, 'Error: Workflow not found.']);
        }
      } catch (error) {
        console.error('Error fetching workflow:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        setLogs(prev => [...prev, `Error fetching workflow: ${errorMessage}`]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflow();

    // Highlight tester: outline matching elements briefly
    if (highlightSelector) {
      try {
        const elements = document.querySelectorAll(highlightSelector);
        elements.forEach((el) => {
          const orig = (el as HTMLElement).style.outline;
          (el as HTMLElement).style.outline = '2px dashed #22c55e';
          setTimeout(() => { (el as HTMLElement).style.outline = orig || ''; }, 2000);
        });
        setLogs(prev => [...prev, `Selector '${highlightSelector}' matches: ${elements.length}`]);
      } catch (e) {
        setLogs(prev => [...prev, `Invalid selector: ${highlightSelector}`]);
      }
    }

    // Cleanup global functions on component unmount
    return () => {
      delete (window as any).__SEENTICS_PREVIEW_WORKFLOW;
      delete (window as any).logToPreviewer;
    }
  }, [id, previewKey, highlightSelector]);


  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading workflow preview...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Load tracker only after workflow is available so preview mode sees it at init */}
      {workflow && (
        <Script
          key={previewKey}
          src="/trackers/tracker.js"
          data-site-id={"preview"}
        />
      )}

      <div className="min-h-screen bg-background p-8 font-sans">
        <div className="max-w-4xl mx-auto">
          <header className="border border-border/40 pb-6 mb-8 text-center bg-card p-6 rounded shadow-sm">
            <h1 className="text-4xl font-bold text-foreground">Simulated Client Website</h1>
            <p className="text-muted-foreground mt-2">
              This page is a testing ground for your workflow. All configured triggers are now active.
            </p>
          </header>
          <main className="bg-card border border-border/40 p-8 rounded shadow-sm space-y-6">
            <div className="prose max-w-none text-muted-foreground">
              <p>
                Your workflow is now running. Perform actions on this page to test your triggers:
              </p>
              <ul>
                <li><strong className="text-foreground">Page View / Time on Page:</strong> These triggers have already started.</li>
                <li><strong className="text-foreground">Scroll Depth:</strong> Scroll down the page to test this trigger.</li>
                <li><strong className="text-foreground">Exit Intent:</strong> Move your mouse cursor towards the top of the browser window to simulate leaving the page.</li>
                <li><strong className="text-foreground">Element Click:</strong> Click the specific button below.</li>
              </ul>
            </div>

            <div className="text-center py-8">
              <button
                id="cta-button"
                className="inline-flex items-center justify-center whitespace-nowrap rounded text-base font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 py-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
              >
                Click Me (for Element Click trigger)
              </button>
            </div>

            <LogViewer logs={logs} clearLogs={() => setLogs([])} onRestart={restartPreview} />

            <div className="prose max-w-none text-muted-foreground space-y-4 pt-6">
              <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
              <p>Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam. Maecenas fermentum consequat mi. Donec fermentum. Pellentesque malesuada nulla a mi. Duis sapien sem, aliquet nec, commodo eget, consequat quis, neque. Aliquam faucibus, elit ut dictum aliquet, felis nisl adipiscing sapien, sed malesuada diam lacus eget erat. Cras mollis scelerisque nunc. Nullam arcu. Aliquam erat volutpat. Duis ac turpis. Integer rutrum ante eu lacus.</p>
              <h3 className="text-xl font-semibold text-foreground">Another Section</h3>
              <p>Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Morbi lacinia molestie dui. Praesent blandit dolor. Sed non quam. In vel mi sit amet augue congue elementum. Morbi in ipsum sit amet pede facilisis laoreet. Donec lacus nunc, viverra nec, blandit vel, egestas et, augue. Vestibulum tincidunt malesuada tellus. Ut ultrices ultrices enim. Curabitur sit amet mauris. Morbi in dui quis est pulvinar ullamcorper. Nulla facilisi. Integer lacinia sollicitudin massa. Cras metus. Sed aliquet risus a tortor. Integer id quam. Morbi mi. Quisque nisl felis, venenatis tristique, dignissim in, ultrices sit amet, augue. Proin sodales libero eget ante.</p>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
