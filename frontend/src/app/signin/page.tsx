'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, Shield, Workflow, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignInPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { setAuth } = useAuth();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError(null);
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.password) {
      setError('Password is required');
      return false;
    }
    return true;
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setError(null);
      setIsLoading(true);

      const response = await api.post('/user/auth/login', {
        email: formData.email.trim(),
        password: formData.password,
      });

      const data = response.data;

      if (data.data?.tokens && data.data?.user) {
        setAuth({
          user: data.data.user,
          access_token: data.data.tokens.accessToken,
          refresh_token: data.data.tokens.refreshToken,
          rememberMe: false
        });
      }

      router.push('/websites');

      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
        variant: "default",
      });

    } catch (error: any) {
      console.error('Sign in error:', error);
      setError(error.message || 'Sign in failed');
      toast({
        title: "Sign In Failed",
        description: error.message || 'Sign in failed',
        variant: "destructive",
      });
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
              Privacy First Analytics. <br />
              <span className="text-primary italic">Better Intelligence.</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg font-medium leading-relaxed max-w-md">
              Understand your users without compromise. Built-in automation to turn insights into growth instantly.
            </p>
          </div>
        </div>

        <div className="relative z-10">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/5 dark:bg-white/5 border border-primary/10 dark:border-white/10 flex items-center justify-center text-primary">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">GDPR & CCPA Compliant</p>
                <p className="text-xs text-slate-500">Cookieless tracking by default.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-white/5 border border-blue-100 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Workflow className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Automation Integrated</p>
                <p className="text-xs text-slate-500">Trigger actions from behavior.</p>
              </div>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-slate-200 dark:border-white/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-600 mb-4">Trusted by modern teams</p>
            <div className="flex items-center gap-4 opacity-40 grayscale saturate-0 text-slate-900 dark:text-white">
                <span className="text-xl font-black italic tracking-tighter">TECHLEAP</span>
                <span className="text-xl font-black italic tracking-tighter">DATASTREAM</span>
                <span className="text-xl font-black italic tracking-tighter">VNET</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Form Section */}
      <div className="flex-1 flex flex-col relative overflow-hidden px-4 py-8 md:p-12 bg-white dark:bg-slate-950">
        <div className="absolute inset-0 pointer-events-none opacity-50 dark:opacity-20 flex items-center justify-center overflow-hidden -z-10">
            <div className="w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full" />
        </div>

        <div className="lg:hidden mb-8 self-center">
             <Link href="/">
                <Logo size="xl" showText={true} textClassName="text-2xl font-bold text-slate-900 dark:text-white" />
            </Link>
        </div>

        <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center md:text-left">
                    <h2 className="text-3xl font-black tracking-tight mb-2 text-slate-900 dark:text-white">Welcome back</h2>
                    <p className="text-muted-foreground font-medium">
                        Log in to your dashboard to manage your analytics.
                    </p>
                </div>

                {error && (
                  <Alert variant="destructive" className="mb-6 rounded-2xl border-0 bg-red-500/10 text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="font-bold">{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        name="email"
                        type="email"
                        placeholder="name@example.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="h-14 pl-12 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-primary text-slate-900 dark:text-white rounded-2xl transition-all"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="h-14 pl-12 pr-12 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-primary text-slate-900 dark:text-white rounded-2xl transition-all"
                        disabled={isLoading}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-3 hover:bg-transparent text-slate-400"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </Button>
                    </div>
                    <div className="flex justify-end">
                      <Link 
                        href="/forgot-password" 
                        className="text-xs text-primary hover:underline font-bold"
                      >
                        Forgot password?
                      </Link>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant={'brand'}
                    className="w-full h-14 text-base font-black shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all rounded-2xl active:scale-[0.98]"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Logging you in...
                      </>
                    ) : (
                        <span className="flex items-center gap-2">
                            Sign in to Dashboard
                            <ArrowRight size={18} />
                        </span>
                    )}
                  </Button>
                </form>

                <div className="mt-8 text-center md:text-left">
                  <p className="text-sm text-muted-foreground font-medium">
                    New to Seentics?{' '}
                    <Link href="/signup" className="text-primary hover:underline font-black">
                      Create a free account
                    </Link>
                  </p>
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
