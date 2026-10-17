'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Ban, Loader2, Mail, RotateCcw, Send, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage, inviteClientUser, removeClientUser, sendClientUserLink, updateClientUser } from '@/features/agency/api';
import { useAgencyMutation, useBranding, useClientUsers, useDomain } from '@/features/agency/queries';
import type { ClientUser, ClientUserStatus, Domain } from '@/features/agency/types';
import { CopyButton, EmptyState, ErrorNote, LoadingRow, Panel, Pill, type Tone } from './ui';

/** Where a client signs in without a domain of the agency's own: seentics.com, under its sign-in name. */
export const CLIENT_SIGNIN_BASE = 'https://seentics.com/signin';

/** The client dashboard on the agency's own domain (the gateway's `dashboard_url`). */
export const clientDashboardUrl = (domain: Pick<Domain, 'hostname' | 'dashboard_url'>): string =>
  (domain.dashboard_url || `https://${domain.hostname}`).replace(/\/+$/, '');

/**
 * Where a client signs in: `/signin` on the agency's own domain once it is active (the domain
 * names the agency), else seentics.com under the agency's sign-in name; `null` with neither.
 */
export function clientSigninUrl(slug: string | null | undefined, domain?: Domain | null): string | null {
  if (domain?.state === 'active') return `${clientDashboardUrl(domain)}/signin`;
  return slug ? `${CLIENT_SIGNIN_BASE}?agency=${encodeURIComponent(slug)}` : null;
}

const STATUS: Record<ClientUserStatus, [Tone, string]> = {
  invited: ['amber', 'Invited'],
  active: ['green', 'Active'],
  disabled: ['muted', 'Disabled'],
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function lastSeen(user: ClientUser): string {
  if (!user.last_seen_at) return user.status === 'invited' ? 'Not signed in yet' : 'Never signed in';
  const d = new Date(user.last_seen_at);
  return Number.isNaN(d.getTime()) ? '—' : `Last seen ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/**
 * The people who sign in to this client's dashboard by email link: invite, resend a link, disable
 * or enable, remove. With the sign-in address to hand out.
 */
export function ClientUsersPanel({ clientId }: { clientId: string }) {
  const users = useClientUsers(clientId);
  const branding = useBranding();
  const domain = useDomain();
  const invite = useAgencyMutation((body: { email: string; name?: string }) => inviteClientUser(clientId, body));
  const resend = useAgencyMutation((userId: string) => sendClientUserLink(clientId, userId));
  const update = useAgencyMutation(({ userId, status }: { userId: string; status: ClientUserStatus }) => updateClientUser(clientId, userId, { status }));
  const remove = useAgencyMutation((userId: string) => removeClientUser(clientId, userId));
  const [confirm, confirmDialog] = useConfirm();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!EMAIL.test(address)) {
      setFormError('Enter a valid email address.');
      return;
    }
    setFormError(null);
    setSentTo(null);
    const body = name.trim() ? { email: address, name: name.trim() } : { email: address };
    invite.mutate(body, {
      onSuccess: () => {
        toast.success('Invite sent');
        setSentTo(address);
        setEmail('');
        setName('');
      },
      onError: err => setFormError(errorMessage(err)),
    });
  };

  const removeUser = async (user: ClientUser) => {
    const ok = await confirm({
      title: `Remove ${user.email}?`,
      description: 'They lose access to this client’s dashboard at once. You can invite them again later.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) remove.mutate(user.id, { onSuccess: () => toast.success('Client user removed'), onError });
  };

  const slug = branding.data?.slug ?? null;
  const signinUrl = clientSigninUrl(slug, domain.data);
  const list = users.data ?? [];

  return (
    <Panel
      data-testid="client-users-panel"
      title="Client sign-in"
      description="People at this client who sign in to their dashboard with an email link. They see only this client’s websites and the pages you allow."
    >
      {confirmDialog}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">Sign-in link</p>
        {branding.isLoading || domain.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : signinUrl ? (
          <div className="flex items-center gap-2">
            <Input readOnly value={signinUrl} aria-label="Client sign-in link" className="h-8 font-mono text-xs" />
            <CopyButton text={signinUrl} label="Copy sign-in link" />
          </div>
        ) : (
          <p data-testid="signin-slug-missing" className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Set a sign-in name in{' '}
            <Link href="/agency/branding" className="font-medium text-primary hover:underline">Branding &amp; domain</Link>{' '}
            to get your clients’ sign-in link.
          </p>
        )}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-2 border-t border-border pt-4" noValidate>
        <p className="text-xs font-medium text-foreground">Invite someone</p>
        <div className="space-y-1">
          <Label htmlFor={`invite-email-${clientId}`} className="text-xs">Email</Label>
          <Input
            id={`invite-email-${clientId}`}
            type="email"
            autoComplete="off"
            placeholder="jess@client.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`invite-name-${clientId}`} className="text-xs">Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input
            id={`invite-name-${clientId}`}
            autoComplete="off"
            placeholder="Jess Morgan"
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        {formError && <ErrorNote>{formError}</ErrorNote>}
        {sentTo && (
          <p role="status" className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <Mail className="h-3.5 w-3.5" />Invite sent to {sentTo}
          </p>
        )}
        <Button type="submit" size="sm" className="h-8 gap-1.5 text-xs" disabled={invite.isPending}>
          {invite.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
          Invite
        </Button>
      </form>

      <div className="mt-4 border-t border-border pt-4">
        {users.isLoading ? (
          <LoadingRow />
        ) : users.isError ? (
          <ErrorNote>{errorMessage(users.error)}</ErrorNote>
        ) : list.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="No client users yet" description="Invite someone above. They get an email with a sign-in link." />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border" aria-label="Client users">
            {list.map(user => {
              const [tone, label] = STATUS[user.status];
              return (
                <li key={user.id} className="space-y-2 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-foreground">{user.name || user.email}</p>
                      {user.name && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
                      <p className="text-[11px] text-muted-foreground">{lastSeen(user)}</p>
                    </div>
                    <Pill tone={tone}>{label}</Pill>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {user.status !== 'disabled' && (
                      <Button
                        variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]"
                        aria-label={`Resend link to ${user.email}`}
                        disabled={resend.isPending}
                        onClick={() => resend.mutate(user.id, { onSuccess: () => toast.success('Sign-in link sent'), onError })}
                      >
                        <Send className="h-3 w-3" />Resend link
                      </Button>
                    )}
                    {user.status === 'disabled' ? (
                      <Button
                        variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]"
                        aria-label={`Enable ${user.email}`}
                        disabled={update.isPending}
                        onClick={() => update.mutate({ userId: user.id, status: 'active' }, { onSuccess: () => toast.success('Client user enabled'), onError })}
                      >
                        <RotateCcw className="h-3 w-3" />Enable
                      </Button>
                    ) : (
                      <Button
                        variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]"
                        aria-label={`Disable ${user.email}`}
                        disabled={update.isPending}
                        onClick={() => update.mutate({ userId: user.id, status: 'disabled' }, { onSuccess: () => toast.success('Client user disabled'), onError })}
                      >
                        <Ban className="h-3 w-3" />Disable
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${user.email}`}
                      onClick={() => void removeUser(user)}
                    >
                      <Trash2 className="h-3 w-3" />Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}
