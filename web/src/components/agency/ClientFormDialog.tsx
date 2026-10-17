'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { AgencyClient, AgencyClientFeatures } from '@/features/agency';
import { isDemoRefusal, useCreateClient, useCustomDomain, useUpdateClient } from '@/features/agency/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, Code2, Copy, KeyRound, Loader2 } from 'lucide-react';
import { createClientUser, type PortalLink } from '@/features/agency';
import { isEnterprise } from '@/lib/features';
import { CLIENT_FEATURE_LABELS, DEFAULT_CLIENT_FEATURES } from '@/features/agency/constants';
import { isAgencyPlanRequired, useAgencyPlan } from '@/features/agency/plan';
import { PortalLinkReveal } from '@/components/agency/client-user-dialogs';

/**
 * Create-and-edit dialog for an agency client.
 *
 * 150 lines in the route file, and the only way to see the edit state was to open a
 * client and click edit. `initial` absent means create.
 */
export interface ClientFormDialogProps {
  websiteId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: AgencyClient | null;
}

export function ClientFormDialog({ websiteId, open, onOpenChange, initial }: ClientFormDialogProps) {
  const isEdit = !!initial;

  const [name, setName]             = useState(initial?.name ?? '');
  const [externalId, setExternalId] = useState(initial?.externalId ?? '');
  const [company, setCompany]       = useState(initial?.company ?? '');
  const [email, setEmail]           = useState(initial?.email ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(initial?.websiteUrl ?? '');
  const [note, setNote]             = useState(initial?.note ?? '');
  const [status, setStatus]         = useState<AgencyClient['status']>(initial?.status ?? 'active');
  const [withLogin, setWithLogin]     = useState(false);
  const [done, setDone]               = useState<{ client: AgencyClient; link?: PortalLink; loginError?: string } | null>(null);
  const [copied, setCopied]           = useState(false);
  const [features, setFeatures]     = useState<AgencyClientFeatures>(
    initial?.featuresEnabled ? { ...initial.featuresEnabled } : { ...DEFAULT_CLIENT_FEATURES },
  );

  // Every time it opens: `useState` read `initial` only on first mount, so editing a second
  // client showed the first one's values.
  useEffect(() => {
    if (open) {
      resetToInitial(initial);
      setDone(null);
      setWithLogin(false);
    }
  }, [open, initial]);

  const resetToInitial = (client?: AgencyClient | null) => {
    setName(client?.name ?? '');
    setExternalId(client?.externalId ?? '');
    setCompany(client?.company ?? '');
    setEmail(client?.email ?? '');
    setWebsiteUrl(client?.websiteUrl ?? '');
    setNote(client?.note ?? '');
    setStatus(client?.status ?? 'active');
    setFeatures(client?.featuresEnabled ? { ...client.featuresEnabled } : { ...DEFAULT_CLIENT_FEATURES });
  };

  const createMutation = useCreateClient(websiteId);
  const updateMutation = useUpdateClient(websiteId);
  const { allowed: agencyPlan, markRefused } = useAgencyPlan(websiteId);
  // Inviting the client's contact to its portal, in the same step: Cloud and the Agency plan only.
  const canInvite = isEnterprise && agencyPlan && !isEdit;
  const { data: domain } = useCustomDomain(websiteId, { enabled: open && canInvite });
  const onError = (err: any) => {
    if (isDemoRefusal(err)) return;
    // Creating a client takes the Agency plan: close the form, and the Clients tab shows the upgrade prompt.
    if (isAgencyPlanRequired(err)) {
      markRefused();
      toast.error('Client workspaces are part of the Agency plan.');
      onOpenChange(false);
      return;
    }
    toast.error(err.response?.data?.error === 'external_id_taken'
      ? 'Another client already has that ID.'
      : err.message || 'Failed to save client');
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!name.trim()) return;
    const req = {
      name: name.trim(),
      externalId: externalId.trim() || null,
      company: company.trim(),
      email: email.trim(),
      websiteUrl: websiteUrl.trim(),
      status,
      note: note.trim(),
      featuresEnabled: features,
    };
    if (isEdit && initial) {
      updateMutation.mutate({ id: initial.id, req }, {
        onSuccess: () => { toast.success('Client updated'); onOpenChange(false); },
        onError,
      });
      return;
    }
    // Create: the website to track goes in the same call, so the response carries its snippet.
    createMutation.mutate(
      { ...req, ...(websiteUrl.trim() ? { website: { name: name.trim(), url: websiteUrl.trim() } } : {}) },
      {
        onSuccess: async (client) => {
          let link: PortalLink | undefined;
          let loginError: string | undefined;
          if (canInvite && withLogin && email.trim()) {
            try {
              link = (await createClientUser({ clientId: client.id, email: email.trim(), name: name.trim() })).link;
            } catch (e: any) {
              loginError = e?.response?.data?.message || e?.message || 'The invitation could not be created.';
            }
          }
          setDone({ client, link, loginError });
        },
        onError,
      },
    );
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy');
    }
  };

  const toggleFeature = (key: keyof AgencyClientFeatures) =>
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));

  if (done) {
    const site = done.client.websites[0];
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader className="bg-card">
            <SheetTitle className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <Check className="h-3 w-3" />
              </span>
              {done.client.name} is ready
            </SheetTitle>
            <SheetDescription>
              {site ? 'Install the tracking code on their website to start collecting data.' : 'The client was created. Add a website from its page to get a tracking code.'}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto bg-muted/40 p-4">
            {site && (
              <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-sm">
                <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <Code2 className="h-3 w-3" /> {site.url}
                  </span>
                  <button type="button" onClick={() => copy(site.snippet)} className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-100">
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy code'}
                  </button>
                </div>
                <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-zinc-200">{site.snippet}</pre>
              </div>
            )}
            {done.link && (
              <div className="space-y-2 rounded-lg border bg-card p-3.5 shadow-sm">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> Portal link for {done.client.email}
                </p>
                <PortalLinkReveal link={done.link} domain={domain} />
              </div>
            )}
            {done.loginError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                The client was created, but the portal invitation was not: {done.loginError}
              </p>
            )}
          </div>
          <SheetFooter className="bg-card pr-20">
            <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  const field = 'h-8 !bg-card text-xs';
  const box = 'space-y-3 rounded-lg border bg-card p-3.5 shadow-sm';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader className="bg-card">
          <SheetTitle>{isEdit ? 'Edit client' : 'Add client'}</SheetTitle>
          <SheetDescription>
            Group a customer&apos;s websites, choose what they collect, and cap their usage.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto bg-muted/40 p-4">
          <div className={box}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} className={field} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Company</Label>
                <Input placeholder="Acme Corp" value={company} onChange={e => setCompany(e.target.value)} className={field} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" placeholder="jane@acme.com" value={email} onChange={e => setEmail(e.target.value)} className={field} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isEdit ? 'Website URL' : 'Website to track'}</Label>
                <Input placeholder="acme.com" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} className={field} />
                {!isEdit && <p className="text-[11px] text-muted-foreground">We create it and give you the tracking code.</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Your ID for this client</Label>
              <Input placeholder="tenant_482" value={externalId} onChange={e => setExternalId(e.target.value)} className={`${field} font-mono`} />
              <p className="text-[11px] text-muted-foreground">Optional. Lets your backend look this client up by your own ID.</p>
            </div>
            {isEdit && (
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={v => setStatus(v as AgencyClient['status'])}>
                  <SelectTrigger className={field}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className={box}>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Features</h4>
              <p className="text-[11px] text-muted-foreground">What this client&apos;s websites collect.</p>
            </div>
            <ul className="divide-y divide-border rounded-md border bg-muted/20">
              {CLIENT_FEATURE_LABELS.map(({ key, label }) => (
                <li key={key} className="flex items-center justify-between px-3 py-2">
                  <span className="text-[13px] text-foreground">{label}</span>
                  <Switch
                    className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
                    checked={features[key]}
                    onCheckedChange={() => toggleFeature(key)}
                    aria-label={label}
                  />
                </li>
              ))}
            </ul>
          </div>

          {canInvite && (
            <div className={`${box} flex flex-row items-center justify-between gap-4 space-y-0`}>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Invite them to the client portal</h4>
                <p className="text-[11px] text-muted-foreground">
                  {email.trim() ? `A magic link for ${email.trim()} to a read-only view of this client's websites.` : 'Add an email above first.'}
                </p>
              </div>
              <Switch
                className="shrink-0"
                checked={withLogin && !!email.trim()}
                disabled={!email.trim()}
                onCheckedChange={setWithLogin}
                aria-label="Invite them to the client portal"
              />
            </div>
          )}

          <div className={box}>
            <Label className="text-xs">Note</Label>
            <Textarea
              placeholder="Internal notes, only you see these"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="min-h-0 resize-none !bg-card text-xs"
            />
          </div>
        </div>

        <SheetFooter className="bg-card pr-20">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || isPending}>
            {isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            {isEdit ? 'Save changes' : 'Add client'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
