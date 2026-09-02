'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthError, PasswordField } from '@/components/auth/AuthField';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

const backToSignIn = (
  <Link href="/signin" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
    <ArrowLeft className="h-3.5 w-3.5" />
    Back to sign in
  </Link>
);

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError('Invalid or expired reset token');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      await api.post('/auth/reset-password', { token, newPassword: password });
      setIsDone(true);
      toast({ title: 'Password reset', description: 'Your password has been successfully updated.' });
      setTimeout(() => router.push('/signin'), 3000);
    } catch (error: any) {
      setError(error.response?.data?.error || error.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell
        title="This link isn't valid"
        subtitle="Reset links expire, and each one can only be used once."
        footer={backToSignIn}
      >
        <div className="flex flex-col items-center text-center">
          <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Request a fresh link and we&apos;ll email you a new one.
          </p>
          <Link href="/forgot-password" className="mt-6 w-full">
            <Button variant="outline" className="w-full font-medium">Request a new link</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (isDone) {
    return (
      <AuthShell title="Password updated" subtitle="You can sign in with your new password now.">
        <div className="flex flex-col items-center text-center">
          <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Taking you to the sign-in page.
          </p>
          <Link href="/signin" className="mt-6 w-full">
            <Button className="w-full font-semibold">Sign in now</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Pick something you haven't used here before."
      footer={backToSignIn}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthError>{error}</AuthError>}

        <PasswordField
          label="New password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          required
        />

        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          placeholder="Repeat your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          required
        />

        <Button type="submit" disabled={isLoading} className="mt-1 w-full font-semibold">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center bg-muted/30 dark:bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
