'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  MAX_NAME_LENGTH, defaultName, initialValues, missingRequired, toCreateInput, toUpdateInput, type FormValues,
} from '@/lib/integration-form';
import type { Connection, CreateInput, Provider, UpdateInput } from '@/features/integrations/types';

export interface ConnectDialogProps {
  provider: Provider;
  /** The destination being edited, or null to add a new one. */
  connection: Connection | null;
  /** Every destination on the site, so a new one gets a name no other uses. */
  existing: readonly Connection[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolves on success; rejects with a message the dialog shows. */
  onSubmit: (body: CreateInput | UpdateInput, isEdit: boolean) => Promise<void>;
}

/**
 * Add (or edit) one destination: a name to recognise it by, then the provider's own fields.
 *
 * Secret fields are `type=password` with autocomplete off, start empty even for a saved
 * connection, and say so: the API never sends a secret back, so "leave blank to keep the saved
 * key" is literally true. The server proves the credentials with a real call before saving, and
 * its message — wrong key, wrong audience, missing scope — is shown here as it arrives.
 */
export function ConnectDialog({ provider, connection, existing, open, onOpenChange, onSubmit }: ConnectDialogProps) {
  const isEdit = connection !== null;
  const [name, setName] = useState(() => connection?.name ?? defaultName(provider, existing));
  const [values, setValues] = useState<FormValues>(() => initialValues(provider.fields, connection));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const missing = missingRequired(provider.fields, values, isEdit);
  const set = (name: string, value: string | boolean) => setValues((v) => ({ ...v, [name]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Give this destination a name.'); return; }
    if (missing.length) { setError(`${missing[0]!.label} is required.`); return; }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(isEdit ? toUpdateInput(provider.fields, values, name) : toCreateInput(provider, name, values), isEdit);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} autoComplete="off" className="space-y-4">
          <DialogHeader>
            <DialogTitle>{connection ? `Edit ${connection.name}` : `Add ${provider.label}`}</DialogTitle>
            <DialogDescription>
              {provider.description}{' '}
              <a href={provider.docs_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Provider docs</a>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="f-destination-name">Name</Label>
            <Input
              id="f-destination-name" value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)}
              placeholder="Newsletter audience" autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">Shown when you choose where a form sends its submissions.</p>
          </div>

          {provider.fields.map((f) =>
            f.type === 'checkbox' ? (
              <div key={f.name} className="flex items-center justify-between gap-3">
                <Label htmlFor={`f-${f.name}`} className="text-sm font-normal">{f.label}</Label>
                <Switch id={`f-${f.name}`} checked={values[f.name] === true} onCheckedChange={(on) => set(f.name, on)} />
              </div>
            ) : (
              <div key={f.name} className="space-y-1.5">
                <Label htmlFor={`f-${f.name}`}>{f.label}</Label>
                <Input
                  id={`f-${f.name}`}
                  type={f.type === 'password' ? 'password' : 'text'}
                  value={String(values[f.name] ?? '')}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.kind === 'credential' && isEdit ? `Saved (…${connection?.credentials_hint || '••••'}). Leave blank to keep.` : f.placeholder}
                  autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                  spellCheck={false}
                  data-1p-ignore
                />
                {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
              </div>
            ),
          )}

          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save and verify' : 'Verify and add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
