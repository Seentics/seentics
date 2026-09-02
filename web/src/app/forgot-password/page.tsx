'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthError, AuthField } from '@/components/auth/AuthField';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      await api.post('/auth/forgot-password', { email });
      setIsSubmitted(true);
      toast({
        title: 'Reset link sent',
        description: 'If an account exists with this email, you will receive a reset link.',
      });
    } catch (error: any) {
      setError(error.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const backToSignIn = (
    <Link href="/signin" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to sign in
    </Link>
  );

  if (isSubmitted) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="If an account exists for that address, a reset link is on its way."
        footer={backToSignIn}
      >
        <div className="flex flex-col items-center text-center">
          <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We sent a reset link to{' '}
            <span className="font-medium text-foreground">{email}</span>. The link expires in a
            short while, so use it soon.
          </p>
          <Button
            variant="outline"
            className="mt-6 w-full font-medium"
            onClick={() => setIsSubmitted(false)}
          >
            Try another email
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email on your account and we'll send you a reset link."
      footer={backToSignIn}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthError>{error}</AuthError>}

        <AuthField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          required
        />

        <Button type="submit" disabled={isLoading} className="mt-1 w-full font-semibold">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
        </Button>
      </form>
    </AuthShell>
  );
}
