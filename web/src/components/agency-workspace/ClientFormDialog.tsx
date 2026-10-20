'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createClient, updateClient } from '@/features/agency/api';
import { useAgencyMutation } from '@/features/agency/queries';
import type { Client, ClientInput } from '@/features/agency/types';
import { useT } from '@/lib/i18n';
import { ErrorNote, useErrorText } from './ui';

const EMPTY = { name: '', company: '', notes: '' };

/** Create a client, or (with `client`) edit its details. */
export function ClientFormDialog({ open, onOpenChange, client, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSaved?: (client: Client) => void;
}) {
  const all = useT().agency;
  const t = all.clientForm;
  const errorMessage = useErrorText();
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
            <DialogTitle>{client ? t.editTitle : t.newTitle}</DialogTitle>
            <DialogDescription>
              {client ? t.editBody : t.newBody}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="client-name" className="text-xs">{t.name}</Label>
            <Input id="client-name" value={form.name} onChange={set('name')} placeholder="Acme Bakery" autoFocus required className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-company" className="text-xs">{t.company} <span className="font-normal text-muted-foreground">{all.common.optional}</span></Label>
            <Input id="client-company" value={form.company} onChange={set('company')} placeholder="Acme Bakery Ltd" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-notes" className="text-xs">{t.notes}</Label>
            <Textarea id="client-notes" value={form.notes} onChange={set('notes')} rows={3} placeholder={t.notesPlaceholder} />
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>{all.common.cancel}</Button>
            <Button type="submit" size="sm" disabled={!form.name.trim() || save.isPending} className="gap-1.5">
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {client ? t.saveChanges : t.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
