'use client';

import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';

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
      toast({ title: 'Account not deleted', description: message ?? 'Something went wrong. Nothing was deleted; try again.', variant: 'destructive' });
      setDeleting(false);
    }
  };

  return (
    <Card className="border border-destructive/30 bg-card shadow-md">
      <CardContent className="space-y-4 p-6">
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p>
            Deletes your account and everything it holds: every website you own with all the analytics, recordings,
            heatmaps and errors it collected, its observability data, your uptime monitors and status pages, and your
            subscription. It cannot be undone.
          </p>
          <p>Own a team other people use? Transfer it to someone first.</p>
        </div>
        {!open ? (
          <div className="flex justify-end">
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete account…
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="delete-account-confirmation" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Your password — or your email address, if you sign in with Google or GitHub
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
                Cancel
              </Button>
              <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDelete} disabled={deleting || !confirmation}>
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete my account permanently
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
