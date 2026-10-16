'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ContactExistsError } from '@/features/leads/api';
import { useAddContact } from '@/features/leads/mutations';
import type { ContactStatus } from '@/features/leads/types';
import { StatusSelect, TagInput } from './parts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY = { email: '', name: '', phone: '', status: 'new' as ContactStatus, tags: [] as string[], notes: '' };

/** Adding someone who never filled in a form here — a phone enquiry, a meeting, a referral. */
export function AddContactDialog({
  websiteId, open, onOpenChange, onOpenContact,
}: { websiteId: string; open: boolean; onOpenChange: (open: boolean) => void; onOpenContact: (id: string) => void }) {
  const [form, setForm] = useState(EMPTY);
  const [existing, setExisting] = useState<string | null>(null);
  const add = useAddContact(websiteId);
  const email = form.email.trim().toLowerCase();
  const valid = EMAIL.test(email);

  const close = (o: boolean) => { onOpenChange(o); if (!o) { setForm(EMPTY); setExisting(null); } };
  const submit = () => add.mutate(
    { email, name: form.name.trim() || undefined, phone: form.phone.trim() || undefined, status: form.status, tags: form.tags, notes: form.notes || undefined },
    {
      onSuccess: (contact) => {
        close(false);
        if (contact) { toast.success('Contact added'); onOpenContact(contact.id); }
      },
      onError: (err) => {
        if (err instanceof ContactExistsError) setExisting(err.contactId ?? '');
        else toast.error('Could not add the contact. Please try again.');
      },
    },
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription>Someone who reached you another way. If they later fill in a form with this email, it joins this contact.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) submit(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="add-email" className="text-xs text-muted-foreground">Email</Label>
            <Input id="add-email" type="email" autoFocus value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setExisting(null); }} placeholder="name@company.com" required />
            {existing !== null && (
              <p className="text-xs text-destructive" role="alert">
                A contact with this email already exists.{' '}
                {existing && <button type="button" className="font-medium underline" onClick={() => { close(false); onOpenContact(existing); }}>Open it</button>}
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-name" className="text-xs text-muted-foreground">Name</Label>
              <Input id="add-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-phone" className="text-xs text-muted-foreground">Phone</Label>
              <Input id="add-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={50} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <StatusSelect value={form.status} onChange={(s) => setForm({ ...form, status: s })} className="h-9 w-full border-input bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-tags" className="text-xs text-muted-foreground">Tags</Label>
            <TagInput id="add-tags" value={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-notes" className="text-xs text-muted-foreground">Notes</Label>
            <Textarea id="add-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={5000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid || add.isPending}>Add contact</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
