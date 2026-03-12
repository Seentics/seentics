'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { acceptInvitation } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No invitation token provided.');
      return;
    }

    if (!user) {
      router.push(`/signin?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`);
      return;
    }

    const accept = async () => {
      try {
        await acceptInvitation(token);
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.response?.data?.error || err.message || 'Failed to accept invitation');
      }
    };

    accept();
  }, [token, user, router]);

  return (
    <div className="max-w-md w-full mx-auto p-8 text-center space-y-6">
      {status === 'loading' && (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <h1 className="text-xl font-bold">Accepting Invitation...</h1>
          <p className="text-sm text-muted-foreground">Please wait while we process your invitation.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-bold">Invitation Accepted!</h1>
          <p className="text-sm text-muted-foreground">
            You now have access to the website. Go to your dashboard to start viewing analytics.
          </p>
          <Button onClick={() => router.push('/websites')} className="mt-4">
            Go to Dashboard
          </Button>
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h1 className="text-xl font-bold">Invitation Failed</h1>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <Button variant="outline" onClick={() => router.push('/websites')} className="mt-4">
            Go to Dashboard
          </Button>
        </>
      )}
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Suspense
        fallback={
          <div className="max-w-md w-full mx-auto p-8 text-center space-y-6">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h1 className="text-xl font-bold">Loading...</h1>
          </div>
        }
      >
        <AcceptInviteContent />
      </Suspense>
    </div>
  );
}
