'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft, Mail, Loader2, CheckCircle2, Shield, Workflow } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left Column: Branding Section */}
      <div className="hidden lg:flex flex-col justify-between p-12 w-full max-w-lg bg-slate-50 dark:bg-slate-950 relative overflow-hidden border-r border-slate-200 dark:border-white/5">
        {/* Animated Background blobs */}
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
              Secure your <br />
              <span className="text-primary italic">Intelligence Engine.</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg font-medium leading-relaxed max-w-md">
              Get back to managing your analytics. Your data is always protected with industry-leading security practices.
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
                <p className="font-bold text-sm text-slate-900 dark:text-white">Enterprise Grade Security</p>
                <p className="text-xs text-slate-500">Encrypted credentials always.</p>
              </div>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-slate-200 dark:border-white/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-600 mb-4">Trusted by modern teams</p>
            <div className="flex items-center gap-4 opacity-40 grayscale saturate-0 text-slate-900 dark:text-white">
                <span className="text-xl font-black italic tracking-tighter">TECHLEAP</span>
                <span className="text-xl font-black italic tracking-tighter">DATASTREAM</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Form Section */}
      <div className="flex-1 flex flex-col relative overflow-hidden px-4 py-8 md:p-12 bg-white dark:bg-slate-950">
        <div className="absolute inset-0 pointer-events-none opacity-50 dark:opacity-20 flex items-center justify-center overflow-hidden -z-10">
            <div className="w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full" />
        </div>

        <div className="lg:hidden mb-8 self-center text-center">
             <Link href="/">
                <Logo size="xl" showText={true} textClassName="text-2xl font-bold text-slate-900 dark:text-white" />
            </Link>
        </div>

        <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md">
                <AnimatePresence mode="wait">
                    {!isSubmitted ? (
                        <motion.div
                            key="reset-form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <div className="mb-8 text-center md:text-left">
                                <h2 className="text-3xl font-black tracking-tight mb-2 text-slate-900 dark:text-white">Reset password</h2>
                                <p className="text-muted-foreground font-medium">
                                    Enter your email address to receive a password reset link.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {error && (
                                    <Alert variant="destructive" className="rounded border-0 bg-red-500/10 text-red-500">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription className="font-bold">{error}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-2">
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            name="email"
                                            type="email"
                                            placeholder="name@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="h-14 pl-12 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-primary text-slate-900 dark:text-white rounded transition-all"
                                            disabled={isLoading}
                                            required
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    variant="brand"
                                    className="w-full h-14 text-base font-black shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all rounded active:scale-[0.98]"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Sending Link...
                                        </>
                                    ) : (
                                        'Send reset link'
                                    )}
                                </Button>
                            </form>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-slate-50 dark:bg-slate-900/50 p-8 md:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl relative"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-blue-500 to-primary" />
                            
                            <div className="flex flex-col items-center text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mb-6 font-black scale-110">
                                    <CheckCircle2 size={32} />
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-4">Check your email</h2>
                                <p className="text-muted-foreground font-medium leading-relaxed mb-8">
                                    We've sent a password reset link to <br /><span className="text-foreground font-bold">{email}</span>.
                                </p>
                                <Button 
                                    variant="outline" 
                                    className="w-full h-12 rounded font-bold border-slate-200 dark:border-slate-700" 
                                    onClick={() => setIsSubmitted(false)}
                                >
                                    Try another email
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="mt-8 text-center md:text-left">
                  <Link href="/signin" className="text-sm text-primary hover:underline font-black flex items-center justify-center md:justify-start">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to sign in
                  </Link>
                </div>
            </div>
        </div>

        <div className="mt-8 self-center lg:self-start">
             <Link href="/">
                <Button variant="ghost" size="sm" className="text-slate-500 font-bold hover:bg-transparent px-0">
                    <ArrowLeft size={16} className="mr-2" />
                    Back to the website
                </Button>
            </Link>
        </div>
      </div>
    </div>
  );
}
