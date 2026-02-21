'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
    Eye,
    EyeOff,
    Loader2,
    Lock,
    Mail,
    ArrowRight,
    User,
    CheckCircle,
    Sparkles,
    Globe
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { TrackingCodeModal } from '@/components/websites/tracking-code-modal';
import { isEnterprise } from '@/lib/features';

function SignUpFlow() {
  const router = useRouter();

  useEffect(() => {
    if (!isEnterprise) {
      router.replace('/setup');
    }
  }, [router]);

  if (!isEnterprise) return null;
  const searchParams = useSearchParams();
  const stepParam = searchParams.get('step');
  const [step, setStep] = useState(1);

  const { toast } = useToast();
  const { setAuth, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [websiteData, setWebsiteData] = useState({
    siteName: '',
    siteUrl: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [newWebsiteId, setNewWebsiteId] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validate step param — only allow step 2 if authenticated
  useEffect(() => {
    if (stepParam) {
      const s = parseInt(stepParam);
      if (s === 2 && isAuthenticated) {
        setStep(2);
      } else {
        setStep(1);
      }
    }
  }, [stepParam, isAuthenticated]);

  // If already authenticated and on step 1, advance to step 2
  useEffect(() => {
    if (isAuthenticated && step === 1) {
      updateStep(2);
    }
  }, [isAuthenticated, step]);

  const updateStep = (newStep: number) => {
    setStep(newStep);
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', newStep.toString());
    router.push(`/signup?${params.toString()}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError(null);
  };

  const validateStep1 = () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1()) return;

    try {
      setError(null);
      setIsLoading(true);

      await api.post('/user/auth/register', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      const loginResponse = await api.post('/user/auth/login', {
        email: formData.email.trim(),
        password: formData.password,
      });

      const authData = loginResponse.data.data;

      if (authData?.tokens && authData?.user) {
        setAuth({
          user: authData.user,
          access_token: authData.tokens.accessToken,
          refresh_token: authData.tokens.refreshToken,
          rememberMe: false
        });
      }

      // Auto-activate free Starter plan
      try {
        await api.post('/user/billing/select-free');
      } catch {
        // Non-critical — starter plan may already be active
      }

      toast({
        title: "Account Created!",
        description: "You're on the free Starter plan. Let's add your first website.",
      });

      updateStep(2);

    } catch (error: any) {
      console.error('Signup error:', error);
      setError(error.message || 'Registration failed');
      toast({
        title: "Registration Failed",
        description: error.message || 'Registration failed',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebsiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { siteName, siteUrl } = websiteData;

    if (!siteName.trim()) {
        toast({
            title: "Validation Error",
            description: "Please provide a website name.",
            variant: "destructive"
        });
        return;
    }

    if (!siteUrl.trim()) {
        toast({
            title: "Validation Error",
            description: "Please provide a valid domain name.",
            variant: "destructive"
        });
        return;
    }

    // Domain validation regex
    const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    const cleanUrl = siteUrl.replace(/^(https?:\/\/)/, '').replace(/\/$/, '');

    if (!domainRegex.test(cleanUrl)) {
        toast({
            title: "Invalid Domain",
            description: "Please provide a valid domain name (e.g. example.com).",
            variant: "destructive"
        });
        return;
    }

    try {
        setIsLoading(true);
        const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
        const response = await api.post('/user/websites', {
            name: siteName.trim(),
            url: normalizedUrl
        });

        const website = response.data.data;

        setNewWebsiteId(website.site_id || website.id);
        setShowTrackingModal(true);

        toast({
            title: "Success",
            description: "Your website has been added. Welcome to Seentics!",
        });
    } catch (error: any) {
        toast({
            title: "Error",
            description: error.response?.data?.message || error.message || 'Failed to add website',
            variant: "destructive"
        });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] selection:bg-primary/20 transition-all duration-500 flex flex-col items-center justify-center p-8 overflow-y-auto custom-scrollbar">

        {/* Background Visuals */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full animate-pulse delay-1000" />
        </div>

        <div className="relative z-10 w-full max-w-lg mb-12 text-center">
            <Link href="/" className="inline-flex items-center gap-3 group mb-8">
                <Logo size="xl" />
                <span className="text-2xl font-black tracking-tighter group-hover:text-primary transition-colors uppercase">SEENTICS</span>
            </Link>

            {/* Step Indicator - 2 Steps */}
            <div className="relative flex justify-between items-center h-10 px-16">
                <div className="absolute top-1/2 left-16 right-16 h-px bg-slate-100 dark:bg-slate-800 -translate-y-1/2" />
                <motion.div
                    initial={false}
                    animate={{ width: step === 1 ? '0%' : '100%' }}
                    className="absolute top-1/2 left-16 h-[2px] bg-primary -translate-y-1/2 transition-all duration-1000 ease-in-out shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                    style={{ maxWidth: 'calc(100% - 128px)' }}
                />

                {[
                    { id: 1, label: 'Signup' },
                    { id: 2, label: 'Add Website' }
                ].map((s) => (
                    <div key={s.id} className="relative z-10 flex flex-col items-center">
                        <motion.div
                            animate={{
                                scale: step === s.id ? 1.1 : 1,
                                backgroundColor: step >= s.id ? 'var(--primary)' : 'var(--background)',
                                borderColor: step >= s.id ? 'var(--primary)' : 'hsl(var(--border))'
                            }}
                            className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all duration-700 ${
                                step >= s.id ? 'text-primary-foreground' : 'bg-background border-border text-muted-foreground shadow-sm'
                            }`}
                        >
                            {step > s.id ? <CheckCircle className="h-3.5 w-3.5" /> : <span className="text-[10px] font-black">{s.id}</span>}
                        </motion.div>
                        <span className={`absolute top-8 text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 whitespace-nowrap ${
                            step === s.id ? 'text-primary' : 'text-slate-500 opacity-60'
                        }`}>
                            {s.label}
                        </span>
                        {step === s.id && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-primary/10 rounded-full blur-md -z-10 animate-pulse" />
                        )}
                    </div>
                ))}
            </div>
        </div>

        <div className="relative z-10 w-full flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
                {step === 1 ? (
                    <motion.div
                        key="account"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5 }}
                        className="w-full max-w-lg bg-card p-8 rounded-xl border border-border/50 shadow-2xl"
                    >
                        <div className="mb-10 text-center">
                            <h2 className="text-4xl font-black tracking-tight mb-3 text-foreground">Create account.</h2>
                            <p className="text-muted-foreground font-medium">Start tracking for free in under 2 minutes.</p>
                        </div>

                        <form onSubmit={handleAccountSubmit} className="space-y-6">
                            {error && (
                                <div className="p-4 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold font-sans">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-1.5 ">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            name="name"
                                            placeholder="Elon Musk"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            className="h-14 pl-12 bg-background border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Your Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            name="email"
                                            type="email"
                                            placeholder="elon@x.com"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            className="h-14 pl-12 bg-background border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Security Password</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input
                                                name="password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                value={formData.password}
                                                onChange={handleInputChange}
                                                className="h-14 pl-12 pr-12 bg-background border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                                required
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input
                                                name="confirmPassword"
                                                type={showConfirmPassword ? "text" : "password"}
                                                placeholder="Confirm"
                                                value={formData.confirmPassword}
                                                onChange={handleInputChange}
                                                className="h-14 pl-12 bg-background border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-16 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                            >
                                {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                    <span className="flex items-center gap-2">
                                        Create account <ArrowRight size={18} />
                                    </span>
                                )}
                            </Button>
                        </form>

                        <div className="mt-8 pt-8 border-t border-border/50 text-center">
                            <p className="text-sm font-medium text-muted-foreground">
                                Already have an account?{' '}
                                <Link href="/signin" className="text-primary font-black hover:underline uppercase tracking-widest text-xs">
                                    Sign In
                                </Link>
                            </p>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="website"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-lg bg-card rounded-xl p-8 border border-border/50 shadow-2xl"
                    >
                        <div className="mb-10 text-center">
                            <h2 className="text-4xl font-black tracking-tight mb-3 text-foreground">Add Website.</h2>
                            <p className="text-muted-foreground font-medium">Connect your first domain to start tracking.</p>
                        </div>

                        <form onSubmit={handleWebsiteSubmit} className="space-y-6">
                            {error && (
                                <div className="p-4 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Website Name</label>
                                    <div className="relative group">
                                        <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            placeholder="My Awesome App"
                                            value={websiteData.siteName}
                                            onChange={(e) => setWebsiteData({...websiteData, siteName: e.target.value})}
                                            className="h-14 pl-12 bg-background border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Website URL</label>
                                    <div className="relative group">
                                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            placeholder="example.com"
                                            value={websiteData.siteUrl}
                                            onChange={(e) => setWebsiteData({...websiteData, siteUrl: e.target.value})}
                                            className="h-14 pl-12 bg-background border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-16 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                            >
                                {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                    <span className="flex items-center gap-2">
                                        Finalize setup <ArrowRight size={18} />
                                    </span>
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-xs text-muted-foreground">
                                You're on the free <span className="font-bold text-foreground">Starter</span> plan.{' '}
                                <Link href="/pricing" className="text-primary font-bold hover:underline">
                                    View upgrade options
                                </Link>
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        <TrackingCodeModal
            isOpen={showTrackingModal}
            onOpenChange={(open) => {
                setShowTrackingModal(open);
                if (!open) {
                    router.push('/websites');
                }
            }}
            siteId={newWebsiteId}
            isNewlyCreated={true}
        />
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#020617]">
            <Loader2 className="animate-spin h-10 w-10 text-primary mb-4" />
            <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Loading...</p>
        </div>
    }>
      <SignUpFlow />
    </Suspense>
  );
}
