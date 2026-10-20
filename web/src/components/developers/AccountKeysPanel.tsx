'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Check, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { ACCOUNT_SCOPES, isDemoRefusal, useAPIKeys, useCreateAPIKey, useDeleteAPIKey, type AccountScope } from '@/components/developers/api-keys';
import { useAgencyPlan } from '@/features/agency/plan';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CopyButton } from '@/components/developers/CopyButton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/features/shop/format';
import { useLocale, useT, type Messages } from '@/lib/i18n';

type KeysMessages = Messages['developers']['keys'];

const DATA_SCOPES: AccountScope[] = ['analytics:read', 'replays:read', 'heatmaps:read'];
const AGENCY_SCOPES: AccountScope[] = ['agency:read', 'agency:write'];

export type AccessPreset = 'full' | 'read' | 'manage' | 'assistant' | 'agency' | 'custom';

const PRESETS: Array<{ id: Exclude<AccessPreset, 'custom'>; scopes: AccountScope[]; agencyOnly?: boolean }> = [
  { id: 'full', scopes: ['websites:read', 'websites:write', ...DATA_SCOPES] },
  { id: 'read', scopes: ['websites:read', ...DATA_SCOPES] },
  { id: 'manage', scopes: ['websites:read', 'websites:write'] },
  { id: 'assistant', scopes: DATA_SCOPES },
  { id: 'agency', scopes: AGENCY_SCOPES, agencyOnly: true },
];

const sameScopes = (a: AccountScope[], b: AccountScope[]) => a.length === b.length && a.every(s => b.includes(s));

/** How a key's scopes read in the table. */
function accessLabel(scopes: AccountScope[], t: KeysMessages): { text: string; strong: boolean } {
  const preset = PRESETS.find(p => sameScopes(p.scopes, scopes));
  if (preset) return { text: t.presets[preset.id].label, strong: preset.id !== 'read' };
  if (sameScopes([...ACCOUNT_SCOPES], scopes)) return { text: t.allScopes, strong: true };
  return { text: t.presets.custom.label, strong: scopes.some(s => s.endsWith(':write')) };
}

/**
 * A new account key: a preset, or any of Core's scopes picked one by one. `preset` opens it on one
 * (the agency workspace's API page links here with `agency`, the AI assistants tab with `assistant`).
 */
export function CreateAccountKeyDialog({ websiteId, open, onOpenChange, preset }: {
  websiteId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preset?: AccessPreset;
}) {
  const all = useT();
  const t = all.developers.keys;
  const { allowed: isAgency } = useAgencyPlan(websiteId);
  const presets = PRESETS.filter(p => !p.agencyOnly || isAgency);
  const [name, setName] = useState('');
  const [access, setAccess] = useState<AccessPreset>(preset ?? 'full');
  const [custom, setCustom] = useState<AccountScope[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const create = useCreateAPIKey(websiteId);

  useEffect(() => { if (open && preset) setAccess(preset); }, [open, preset]);

  const scopes = access === 'custom' ? custom : PRESETS.find(p => p.id === access)!.scopes;
  const toggle = (scope: AccountScope) =>
    setCustom(prev => (prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]));

  const submit = () =>
    create.mutate({ name: name.trim(), scopes: ACCOUNT_SCOPES.filter(s => scopes.includes(s)) }, {
      onSuccess: key => { setSecret(key.key ?? null); setName(''); onOpenChange(false); },
      onError: e => { if (!isDemoRefusal(e)) toast.error((e as Error).message || t.createFailed); },
    });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader className="bg-card">
            <SheetTitle>{t.newTitle}</SheetTitle>
            <SheetDescription>{t.newDescription}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto bg-muted/40 p-4">
            <div className="space-y-1 rounded-lg border bg-card p-3.5 shadow-sm">
              <Label className="text-xs">{t.name}</Label>
              <Input placeholder={t.namePlaceholder} value={name} onChange={e => setName(e.target.value)} className="h-8 !bg-card text-xs" autoFocus />
            </div>
            <div className="space-y-2 rounded-lg border bg-card p-3.5 shadow-sm">
              <Label className="text-xs">{t.access}</Label>
              {[...presets.map(p => p.id), 'custom' as const].map(id => ({ id, ...t.presets[id] })).map(a => (
                <button
                  key={a.id}
                  type="button"
                  data-testid={`key-access-${a.id}`}
                  aria-pressed={access === a.id}
                  onClick={() => setAccess(a.id)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                    access === a.id ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/30',
                  )}
                >
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </button>
              ))}
            </div>
            {access === 'custom' && (
              <fieldset className="space-y-1.5 rounded-lg border bg-card p-3.5 shadow-sm">
                <legend className="sr-only">{t.scopes}</legend>
                <Label className="text-xs">{t.scopes}</Label>
                {ACCOUNT_SCOPES.map(scope => (
                  <label key={scope} className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1 hover:bg-muted/50">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 accent-primary"
                      checked={custom.includes(scope)}
                      onChange={() => toggle(scope)}
                      aria-label={scope}
                    />
                    <span className="min-w-0">
                      <code className="font-mono text-xs text-foreground">{scope}</code>
                      <span className="block text-[11px] text-muted-foreground">
                        {t.scopeLabels[scope]}
                        {AGENCY_SCOPES.includes(scope) && !isAgency && t.needsAgency}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
          </div>
          <SheetFooter className="bg-card pr-20">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{all.actions.cancel}</Button>
            <Button size="sm" onClick={submit} disabled={!name.trim() || scopes.length === 0 || create.isPending}>
              {create.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              {t.createKey}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={!!secret} onOpenChange={v => !v && setSecret(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              {t.created}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {t.copyNow}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-xs">{secret}</code>
              <CopyButton text={secret ?? ''} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setSecret(null)}>{all.actions.done}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Account-level keys for the Data API and the Management API, as a table of rows. */
export function AccountKeysList({ websiteId, onCreate }: { websiteId: string; onCreate: () => void }) {
  const all = useT();
  const t = all.developers.keys;
  const { locale } = useLocale();
  const { data: keys = [], isLoading } = useAPIKeys(websiteId);
  const revoke = useDeleteAPIKey(websiteId);
  const [confirm, confirmDialog] = useConfirm();

  if (isLoading) {
    return (
      <div className="space-y-3 p-5">
        {[0, 1].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{t.empty}</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {t.emptyBody}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" />
          {t.createFirst}
        </Button>
      </div>
    );
  }

  return (
    <>
    {confirmDialog}
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/60 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <th className="px-5 py-3 font-medium">{all.actions.name}</th>
          <th className="px-5 py-3 font-medium">{t.colKey}</th>
          <th className="px-5 py-3 font-medium">{t.access}</th>
          <th className="px-5 py-3 font-medium">{t.colLastUsed}</th>
          <th className="px-5 py-3 font-medium">{t.colCreated}</th>
          <th className="w-14 px-5 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border/60">
        {keys.map(key => {
          const access = accessLabel(key.scopes, t);
          return (
            <tr key={key.id} className="hover:bg-muted/35">
              <td className="px-5 py-3.5 font-medium text-foreground">{key.name}</td>
              <td className="px-5 py-3.5">
                <code className="font-mono text-[13px] text-muted-foreground">{key.keyPrefix}…</code>
              </td>
              <td className="px-5 py-3.5">
                <span className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-semibold',
                  access.strong
                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {access.text}
                </span>
              </td>
              <td className="px-5 py-3.5 text-muted-foreground">
                {key.lastUsed
                  ? locale === 'bn' ? timeAgo(key.lastUsed, locale) : formatDistanceToNow(new Date(key.lastUsed), { addSuffix: true })
                  : t.never}
              </td>
              <td className="px-5 py-3.5 text-muted-foreground">{new Date(key.createdAt).toLocaleDateString(locale === 'bn' ? 'bn-BD-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
              <td className="px-5 py-3.5 text-right">
                <Button
                  variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  title={t.revoke}
                  disabled={revoke.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: t.revokeTitle(key.name),
                      description: t.revokeBody,
                      confirmLabel: t.revoke,
                      destructive: true,
                    });
                    if (!ok) return;
                    revoke.mutate(key.id, {
                      onSuccess: () => toast.success(t.revoked),
                      onError: e => { if (!isDemoRefusal(e)) toast.error((e as Error).message); },
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </>
  );
}
