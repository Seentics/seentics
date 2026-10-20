'use client';

import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';
import { useT } from '@/lib/i18n';

/**
 * Delete the account and everything in it, in every product (GDPR Art. 17).
 *
 * One field confirms it: the password, or — for an account that signs in only with
 * Google or GitHub, and so has none — the email address. It is sent as both; the
 * server checks whichever the account actually has.
 */
export function DeleteAccountCard() {
  const { resetAuth } = useAuth();
  const { toast } = useToast();
  const tAll = useT();
  const t = tAll.settings.deleteAccount;
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirmation) return;
    setDeleting(true);
    try {
      await api.delete('/user/users/me', { data: { password: confirmation, email: confirmation } });
      resetAuth();
      window.location.href = '/';
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast({ title: t.notDeleted, description: message ?? t.failed, variant: 'destructive' });
      setDeleting(false);
    }
  };

  return (
    <Card className="border border-destructive/30 bg-card shadow-md">
      <CardContent className="space-y-4 p-6">
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p>{t.body}</p>
          <p>{t.team}</p>
        </div>
        {!open ? (
          <div className="flex justify-end">
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              {t.open}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="delete-account-confirmation" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {t.confirmLabel}
              </label>
              <Input
                id="delete-account-confirmation"
                type="password"
                autoComplete="current-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); setConfirmation(''); }} disabled={deleting}>
                {tAll.actions.cancel}
              </Button>
              <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDelete} disabled={deleting || !confirmation}>
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {t.confirm}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
