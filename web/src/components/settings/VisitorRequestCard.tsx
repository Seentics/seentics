'use client';

import { useState } from 'react';
import { Download, Loader2, Trash2, UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { privacyAPI } from '@/features/privacy/api';

/**
 * Answer one visitor's data request (GDPR Art. 15, 17 and 20): find them by the visitor
 * id Seentics gave them, or by the user id your site passed to `seentics.identify()`,
 * then download everything held about them or erase it.
 */
export function VisitorRequestCard({ websiteId }: { websiteId: string }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState<'export' | 'erase' | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Seentics visitor ids start with `v-`; anything else is the site's own user id.
  const who = () => {
    const id = value.trim();
    return id.startsWith('v-') ? { visitorId: id } : { userId: id };
  };

  const exportData = async () => {
    setBusy('export');
    try {
      const data = await privacyAPI.exportVisitorData(websiteId, who());
      if (!data?.found) {
        toast.info('No data is held for this visitor.');
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `seentics-visitor-${value.trim().slice(0, 40)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('Visitor data exported.');
    } catch {
      toast.error('Could not export this visitor’s data.');
    } finally {
      setBusy(null);
    }
  };

  const erase = async () => {
    if (!confirming) { setConfirming(true); return; }
    setBusy('erase');
    try {
      const data = await privacyAPI.eraseVisitorData(websiteId, who());
      toast.success(data?.found ? 'Everything held about this visitor was erased.' : 'No data is held for this visitor.');
      setValue('');
    } catch {
      toast.error('Could not erase this visitor’s data. Nothing was half-deleted — try again.');
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <UserSearch className="h-4 w-4 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Visitor data request</h4>
            <p className="text-[10px] text-muted-foreground">GDPR Articles 15, 17 and 20</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          When a visitor asks what you hold about them, or asks you to delete it: enter their
          Seentics visitor id (<code>v-…</code>) or the user id your site passes to{' '}
          <code>seentics.identify()</code>. Export downloads their events, recordings, profile
          and errors; erase removes all of it, recordings included. Visitors who never consented
          were never identified, so there is nothing of theirs to find.
        </p>
        <Input
          value={value}
          onChange={(e) => { setValue(e.target.value); setConfirming(false); }}
          placeholder="v-… or your user id"
          aria-label="Visitor id or user id"
          className="h-9 text-sm font-mono"
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportData} disabled={!value.trim() || busy !== null} className="gap-1.5 text-xs font-semibold">
            {busy === 'export' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export visitor data
          </Button>
          <Button size="sm" variant={confirming ? 'destructive' : 'outline'} onClick={erase} disabled={!value.trim() || busy !== null} className="gap-1.5 text-xs font-semibold">
            {busy === 'erase' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {confirming ? 'Confirm: erase permanently' : 'Erase visitor data'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
