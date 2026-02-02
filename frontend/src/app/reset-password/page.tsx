'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft, Lock, Loader2, CheckCircle2, Shield, Eye, EyeOff } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

      await api.post('/auth/reset-password', {
        token,
        newPassword: password
      });

      setIsDone(true);
      toast({
        title: "Password reset",
        description: "Your password has been successfully updated.",
      });

      // Redirect to sign in after 3 seconds
      setTimeout(() => {
        router.push('/signin');
      }, 3000);

    } catch (error: any) {
      console.error('Reset password error:', error);
      setError(error.response?.data?.error || error.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold">Invalid Link</h2>
        <p className="text-slate-500">This password reset link is invalid or has expired.</p>
        <Link href="/forgot-password" title="Go back">
          <Button variant="outline" className="mt-4">
            Request new link
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {!isDone ? (
        <motion.div
          key="form"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">New password</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Please enter your new password below.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive animate-in fade-in zoom-in duration-300">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-medium">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    type={showPassword ? "text" : "password"}
                    placeholder="New password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 focus:ring-primary/20"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm new password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 focus:ring-primary/20"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300" 
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </span>
              ) : 'Reset Password'}
            </Button>
          </form>
        </motion.div>
      ) : (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8"
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-6">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Password Updated</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Your password has been changed successfully. You're being redirected to the sign in page.
          </p>
          <Link href="/signin">
            <Button variant="link" className="mt-4 text-primary font-bold">
              Sign in now
            </Button>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left Column: Branding Section */}
      <div className="hidden lg:flex flex-col justify-between p-12 w-full max-w-lg bg-slate-50 dark:bg-slate-950 relative overflow-hidden border-r border-slate-200 dark:border-white/5">
        <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[100px] animate-pulse delay-700" />
        </div>

        <div className="relative z-10">
          <Link href="/">
            <Logo size="xl" showText={true} textClassName="text-2xl font-bold text-slate-900 dark:text-white" />
          </Link>
          
          <div className="mt-20">
            <h1 className="text-4xl font-black tracking-tight mb-6 leading-tight text-slate-900 dark:text-white">
              Resume your <br />
              <span className="text-primary italic">Analytics Journey.</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg font-medium leading-relaxed max-w-md">
              Secure access restored. Back to measuring what matters most for your business growth.
            </p>
          </div>
        </div>

        <div className="relative z-10">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded bg-primary/5 dark:bg-white/5 border border-primary/10 dark:border-white/10 flex items-center justify-center text-primary">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Enhanced Protection</p>
                <p className="text-xs text-slate-500">Your account security is our top priority.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Reset Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden mb-12 flex justify-center">
            <Logo size="lg" />
          </div>

          <Suspense fallback={<div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <ResetPasswordForm />
          </Suspense>

          <div className="mt-8 text-center border-t border-slate-100 dark:border-white/5 pt-8">
            <Link 
              href="/signin" 
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
