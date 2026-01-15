'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

      // In a real app, you'd call your API here
      // await api.post('/user/auth/forgot-password', { email });
      
      // Simulating API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      setIsSubmitted(true);
      toast({
        title: "Reset link sent",
        description: "If an account exists with this email, you will receive a reset link.",
      });

    } catch (error: any) {
      console.error('Password reset error:', error);
      setError(error.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
            <Link href="/">
                <Logo size="xl" showText={true} textClassName="text-2xl font-bold" />
            </Link>
        </div>

        <Card className="border-0 shadow-2xl dark:bg-gray-800 rounded-2xl overflow-hidden">
          <CardHeader className="space-y-1 pb-8">
            <CardTitle className="text-2xl font-bold text-center">Reset password</CardTitle>
            <CardDescription className="text-center">
              {isSubmitted 
                ? "Check your email for a reset link" 
                : "Enter your email address to receive a password reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSubmitted ? (
              <div className="text-center space-y-6 pt-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mb-2">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <p className="text-sm text-muted-foreground">
                  We've sent a password reset link to <span className="font-semibold text-foreground">{email}</span>.
                </p>
                <Button variant="outline" className="w-full rounded-xl" onClick={() => setIsSubmitted(false)}>
                  Try another email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-10 bg-slate-50 dark:bg-slate-900 border-0 focus-visible:ring-1"
                    disabled={isLoading}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all rounded-xl"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    /* Sending... */
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </Button>
              </form>
            )}

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 text-center">
              <Link href="/signin" className="text-sm text-primary hover:underline font-semibold flex items-center justify-center">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
