'use client';

/**
 * Send one test event to a destination. For Meta, a test event code from Events Manager → Test
 * events makes it show there without counting as a real conversion; GA4 is checked against its
 * validation endpoint, so nothing reaches the reports.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTestDestination } from '@/features/conversions/mutations';
import type { Destination, TestResult } from '@/features/conversions/types';
import { PLATFORMS } from './conversion-format';

const TEST_COPY: Record<Destination['platform'], string> = {
  meta: 'Sends a test Purchase to your pixel. With a test event code it appears under Events Manager → Test events and is not counted as a real sale.',
  ga4: 'Checks a test purchase against Google’s validation endpoint. Nothing is added to your GA4 reports.',
  tiktok: 'Sends a test purchase to your pixel. With a test event code it appears under Events Manager → Test events and is not counted as a real sale.',
  linkedin: 'LinkedIn has no test mode, so nothing is sent: this checks the token and that each mapped conversion rule exists in the ad account.',
};

export function TestEventDialog({
  websiteId, destination, onClose,
}: { websiteId: string; destination: Destination | null; onClose: () => void }) {
  const test = useTestDestination(websiteId);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<TestResult | null>(null);

  useEffect(() => { setCode(destination?.config.test_event_code ?? ''); setResult(null); }, [destination]);
  if (!destination) return null;
  const { testCode } = PLATFORMS[destination.platform];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send a test event</DialogTitle>
          <DialogDescription>
            {TEST_COPY[destination.platform]}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setResult(null);
            test.mutate(
              { id: destination.id, testEventCode: code.trim() || undefined },
              { onSuccess: setResult, onError: (err) => setResult({ ok: false, message: err instanceof Error ? err.message : 'The test could not be sent.' }) },
            );
          }}
        >
          {testCode && (
            <div className="space-y-1.5">
              <Label htmlFor="test-code" className="text-xs text-muted-foreground">Test event code (optional)</Label>
              <Input id="test-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="TEST12345" className="font-mono text-sm" autoComplete="off" />
            </div>
          )}
          {result && (
            <p role="status" className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${result.ok ? 'border-emerald-500/30 text-foreground' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
              {result.ok ? <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <XCircle className="mt-px h-3.5 w-3.5 shrink-0" />}
              <span>{result.message}</span>
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>{result?.ok ? 'Done' : 'Cancel'}</Button>
            <Button type="submit" size="sm" disabled={test.isPending}>
              {test.isPending ? (testCode || destination.platform === 'ga4' ? 'Sending…' : 'Checking…') : destination.platform === 'linkedin' ? 'Check connection' : `Send to ${PLATFORMS[destination.platform].label}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
