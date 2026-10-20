'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inviteMemberByToken, type WebsiteInvitation } from '@/lib/websites-api';
import { toast } from 'sonner';
import { Check, Copy, Loader2 } from 'lucide-react';
import { isEnterprise } from '@/lib/features';
import { useT } from '@/lib/i18n';

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
}

export function InviteMemberModal({ open, onOpenChange, websiteId }: InviteMemberModalProps) {
  if (!isEnterprise) return null;

  const all = useT();
  const t = all.dashboard.invite;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      inviteMemberByToken(websiteId, data),
    onSuccess: (inv: WebsiteInvitation) => {
      queryClient.invalidateQueries({ queryKey: ['invitations', websiteId] });
      const link = `${window.location.origin}/accept-invite?token=${inv.token}`;
      setInviteLink(link);
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || error.message || t.failed;
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t.emailRequired);
      return;
    }
    mutation.mutate({ email, role });
  };

  const handleCopy = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      toast.success(t.linkCopied);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after animation
    setTimeout(() => {
      setEmail('');
      setRole('viewer');
      setInviteLink(null);
      setCopied(false);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        {inviteLink ? (
          <>
            <DialogHeader>
              <DialogTitle>{t.createdTitle}</DialogTitle>
              <DialogDescription>
                {t.shareBefore}<strong>{email}</strong>{t.shareAfter}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border text-xs font-mono break-all">
                <span className="flex-1 min-w-0 truncate">{inviteLink}</span>
              </div>
              <Button className="w-full gap-2" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? all.actions.copied : t.copyLink}
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>{all.actions.done}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{t.title}</DialogTitle>
              <DialogDescription>
                {t.description}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">{t.email}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">{t.role}</Label>
                <Select value={role} onValueChange={(v: any) => setRole(v)}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder={t.selectRole} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t.admin}</SelectItem>
                    <SelectItem value="viewer">{t.viewer}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {role === 'admin'
                    ? t.adminHint
                    : t.viewerHint}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                {all.actions.cancel}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t.create}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
