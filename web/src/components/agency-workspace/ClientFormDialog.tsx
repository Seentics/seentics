'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createClient, errorMessage, updateClient } from '@/features/agency/api';
import { useAgencyMutation } from '@/features/agency/queries';
import type { Client, ClientInput } from '@/features/agency/types';
import { ErrorNote } from './ui';

const EMPTY = { name: '', company: '', notes: '' };

/** Create a client, or (with `client`) edit its details. */
export function ClientFormDialog({ open, onOpenChange, client, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSaved?: (client: Client) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const save = useAgencyMutation((body: ClientInput & { name: string }) => (client ? updateClient(client.id, body) : createClient(body)));

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(client
      ? { name: client.name, company: client.company, notes: client.notes }
      : EMPTY);
  }, [open, client]);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    save.mutate(
      {
        name: form.name.trim(),
        company: form.company.trim(),
        notes: form.notes.trim(),
      },
      {
        onSuccess: saved => { onSaved?.(saved); onOpenChange(false); },
        onError: err => setError(errorMessage(err)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{client ? 'Edit client' : 'New client'}</DialogTitle>
            <DialogDescription>
              {client ? 'Change how this client is named and reached.' : 'A client groups the websites you run for one customer.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="client-name" className="text-xs">Name</Label>
            <Input id="client-name" value={form.name} onChange={set('name')} placeholder="Acme Bakery" autoFocus required className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-company" className="text-xs">Company <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="client-company" value={form.company} onChange={set('company')} placeholder="Acme Bakery Ltd" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-notes" className="text-xs">Private notes</Label>
            <Textarea id="client-notes" value={form.notes} onChange={set('notes')} rows={3} placeholder="Only your team sees these." />
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!form.name.trim() || save.isPending} className="gap-1.5">
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {client ? 'Save changes' : 'Create client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
