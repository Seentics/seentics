'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addClientWebsite, createWebsite, errorMessage } from '@/features/agency/api';
import { useAgencyMutation, useClients } from '@/features/agency/queries';
import type { CreatedWebsite } from '@/features/agency/types';
import { InstallPanel } from './InstallPanel';
import { ErrorNote } from './ui';

const NONE = '__none__';

/**
 * Adds a website — under `clientId` when given, else under the client picked here — then shows
 * its snippet and the tracking check in the same dialog.
 */
export function AddWebsiteDialog({ open, onOpenChange, clientId }: { open: boolean; onOpenChange: (open: boolean) => void; clientId?: string }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [pick, setPick] = useState<string>(NONE);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedWebsite | null>(null);
  const clients = useClients({ status: 'active' });
  const create = useAgencyMutation((body: { name: string; url: string; client_id: string | null }) =>
    clientId ? addClientWebsite(clientId, { name: body.name, url: body.url }) : createWebsite(body));

  useEffect(() => {
    if (open) { setName(''); setUrl(''); setPick(NONE); setError(null); setCreated(null); }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    create.mutate(
      { name: name.trim(), url: url.trim(), client_id: pick === NONE ? null : pick },
      { onSuccess: setCreated, onError: err => setError(errorMessage(err)) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        {created ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Install {created.name}</DialogTitle>
              <DialogDescription>Add this snippet to every page of {created.url}, then verify.</DialogDescription>
            </DialogHeader>
            <InstallPanel websiteId={created.id} initial={created.install} />
            <DialogFooter>
              <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add website</DialogTitle>
              <DialogDescription>You get the tracking snippet as soon as it is added.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="site-name" className="text-xs">Name</Label>
              <Input id="site-name" value={name} onChange={e => setName(e.target.value)} placeholder="Acme Bakery" autoFocus className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-url" className="text-xs">URL</Label>
              <Input id="site-url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://acmebakery.com" className="h-9" />
            </div>
            {!clientId && (
              <div className="space-y-1.5">
                <Label className="text-xs">Client</Label>
                <Select value={pick} onValueChange={setPick}>
                  <SelectTrigger className="h-9" aria-label="Client"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No client</SelectItem>
                    {clients.items.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {error && <ErrorNote>{error}</ErrorNote>}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={!name.trim() || !url.trim() || create.isPending} className="gap-1.5">
                {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Add website
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
