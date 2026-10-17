'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { Check, Loader2, MailPlus, MoreVertical, RefreshCw, Ban, Trash2 } from 'lucide-react';
import {
  createClientUser,
  deleteClientUser,
  portalLinkUrl,
  resendClientUserLink,
  revokeClientUser,
  type AgencyClient,
  type ClientUser,
  type CustomDomain,
  type IssuedClientUserLink,
  type PortalLink,
} from '@/features/agency';
import { isDemoRefusal, useAgencyMutation } from '@/features/agency/queries';
import { isAgencyPlanRequired, useAgencyPlan } from '@/features/agency/plan';
import { USER_STATUS_STYLES } from '@/features/agency/constants';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CopyButton } from '@/components/agency/CopyButton';
import { cn } from '@/lib/utils';

/**
 * Client users: a client's contacts, each with a magic link to that client's read-only portal.
 * There is no password. A link's token is in the response that made it and nowhere else, so the
 * link is shown once, right then; "Resend link" makes a fresh one (and kills the old ones).
 * Seentics sends no email: the agency passes the link on.
 */

const CLIENT_USER_ERRORS: Record<string, string> = {
  client_user_exists: 'That person already has access to this client.',
  client_user_revoked: 'Their access was revoked. Delete them, then invite them again.',
  client_user_not_found: 'That person no longer exists.',
  client_not_found: 'That client no longer exists.',
};

/** Handles a failed client-access call: the plan prompt for 403 AGENCY_PLAN_REQUIRED, else a toast. */
export function useClientAccessError(websiteId: string) {
  const { markRefused } = useAgencyPlan(websiteId);
  return (e: unknown) => {
    if (isDemoRefusal(e)) return;
    if (isAgencyPlanRequired(e)) {
      markRefused();
      toast.error('Client access is part of the Agency plan.');
      return;
    }
    const code = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
    toast.error((code && CLIENT_USER_ERRORS[code]) || (e as Error)?.message || 'Something went wrong');
  };
}

/** A portal link, the one time it can be shown, with its copy button. */
export function PortalLinkReveal({ link, domain, label }: { link: PortalLink; domain: CustomDomain | null | undefined; label?: string }) {
  const url = portalLinkUrl(link, domain);
  return (
    <div className="space-y-2" data-testid="portal-link">
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-all rounded-md border border-border/60 bg-muted/50 px-2.5 py-2 font-mono text-xs">
          {url}
        </code>
        <CopyButton text={url} />
      </div>
      <p className="text-[11px] text-amber-600 dark:text-amber-400">
        Copy it now and send it yourself: it won&apos;t be shown again. Works until {format(new Date(link.expiresAt), 'MMM d, yyyy')}.
      </p>
    </div>
  );
}

// ─── Invite ──────────────────────────────────────────────────────────────────

export interface InviteClientUserDialogProps {
  websiteId: string;
  client: Pick<AgencyClient, 'id' | 'name' | 'email'> | null;
  domain: CustomDomain | null | undefined;
  onOpenChange: (open: boolean) => void;
}

export function InviteClientUserDialog({ websiteId, client, domain, onOpenChange }: InviteClientUserDialogProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [issued, setIssued] = useState<IssuedClientUserLink | null>(null);
  const onError = useClientAccessError(websiteId);
  const invite = useAgencyMutation(websiteId, createClientUser);
  const open = !!client;

  useEffect(() => {
    if (!client) return;
    setEmail(client.email ?? '');
    setName('');
    setIssued(null);
  }, [client]);

  const submit = () => {
    if (!client || !email.trim()) return;
    invite.mutate(
      { clientId: client.id, email: email.trim(), name: name.trim() || undefined },
      {
        onSuccess: setIssued,
        onError: (e) => {
          onError(e);
          if (isAgencyPlanRequired(e)) onOpenChange(false);
        },
      },
    );
  };

  const field = 'h-8 !bg-card text-xs';
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="bg-card">
          <SheetTitle>{issued ? 'Invitation ready' : `Invite to ${client?.name ?? ''}'s portal`}</SheetTitle>
          <SheetDescription>
            {issued
              ? `Send this link to ${issued.clientUser.email}. It opens a read-only view of ${client?.name}'s websites.`
              : 'They get a magic link to a read-only view of this client’s websites. No password, no Seentics account.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-3 overflow-y-auto bg-muted/40 p-4">
          {issued ? (
            <div className="space-y-3 rounded-lg border bg-card p-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <Check className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{issued.clientUser.name || issued.clientUser.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{issued.clientUser.email}</p>
                </div>
              </div>
              <PortalLinkReveal link={issued.link} domain={domain} />
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border bg-card p-3.5 shadow-sm">
              <div className="space-y-1">
                <Label htmlFor="client-user-email" className="text-xs">Email <span className="text-destructive">*</span></Label>
                <Input id="client-user-email" type="email" placeholder="jane@acme.com" value={email} onChange={e => setEmail(e.target.value)} className={field} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="client-user-name" className="text-xs">Name</Label>
                <Input id="client-user-name" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} className={field} />
              </div>
            </div>
          )}
        </div>
        <SheetFooter className="bg-card pr-20">
          {issued ? (
            <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={submit} disabled={!email.trim() || invite.isPending}>
                {invite.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <MailPlus className="mr-1 h-3.5 w-3.5" />}
                Create link
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── A fresh link, after "Resend link" ───────────────────────────────────────

export function ResentLinkDialog({ issued, domain, onClose }: { issued: IssuedClientUserLink | null; domain: CustomDomain | null | undefined; onClose: () => void }) {
  return (
    <Sheet open={!!issued} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="bg-card">
          <SheetTitle>New link for {issued?.clientUser.name || issued?.clientUser.email}</SheetTitle>
          <SheetDescription>Their earlier links have stopped working.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto bg-muted/40 p-4">
          {issued && (
            <div className="rounded-lg border bg-card p-3.5 shadow-sm">
              <PortalLinkReveal link={issued.link} domain={domain} />
            </div>
          )}
        </div>
        <SheetFooter className="bg-card pr-20">
          <Button size="sm" onClick={onClose}>Done</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── The list ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ClientUser['status'], string> = { invited: 'Invited', active: 'Active', revoked: 'Revoked' };

function lastSeen(u: ClientUser): string {
  if (u.status === 'revoked') return 'Access revoked';
  if (u.lastSeenAt) return `Last opened ${formatDistanceToNow(new Date(u.lastSeenAt), { addSuffix: true })}`;
  if (u.linkExpiresAt) return `Link not opened yet · expires ${format(new Date(u.linkExpiresAt), 'MMM d')}`;
  return 'No live link';
}

/** A client's users, each with Resend link, Revoke and Delete. */
export function ClientUserList({ websiteId, users, domain }: { websiteId: string; users: ClientUser[]; domain: CustomDomain | null | undefined }) {
  const [resent, setResent] = useState<IssuedClientUserLink | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const onError = useClientAccessError(websiteId);
  const resend = useAgencyMutation(websiteId, resendClientUserLink);
  const revoke = useAgencyMutation(websiteId, revokeClientUser);
  const remove = useAgencyMutation(websiteId, deleteClientUser);

  return (
    <>
      {confirmDialog}
      <ResentLinkDialog issued={resent} domain={domain} onClose={() => setResent(null)} />
      <ul className="divide-y divide-border/60">
        {users.map(u => (
          <li key={u.id} className="flex items-center gap-3 px-5 py-3" data-testid="client-user">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                <span className="truncate">{u.name || u.email}</span>
                <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold', USER_STATUS_STYLES[u.status])}>
                  {STATUS_LABEL[u.status]}
                </span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {u.name ? `${u.email} · ` : ''}{lastSeen(u)}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Actions for ${u.email}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {u.status !== 'revoked' && (
                  <DropdownMenuItem onClick={() => resend.mutate(u.id, { onSuccess: setResent, onError })}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Resend link
                  </DropdownMenuItem>
                )}
                {u.status !== 'revoked' && (
                  <DropdownMenuItem
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Revoke ${u.email}'s access?`,
                        description: 'Every link they have stops working at once. You can delete them afterwards and invite them again.',
                        confirmLabel: 'Revoke access',
                        destructive: true,
                      });
                      if (ok) revoke.mutate(u.id, { onSuccess: () => toast.success('Access revoked'), onError });
                    }}
                  >
                    <Ban className="mr-2 h-3.5 w-3.5" /> Revoke access
                  </DropdownMenuItem>
                )}
                {u.status !== 'revoked' && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete ${u.email}?`,
                      description: 'They are removed from this client, and their links stop working.',
                      confirmLabel: 'Delete',
                      destructive: true,
                    });
                    if (ok) remove.mutate(u.id, { onSuccess: () => toast.success('Removed'), onError });
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
    </>
  );
}
