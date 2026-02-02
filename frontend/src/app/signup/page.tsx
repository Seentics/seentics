'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
    AlertCircle, 
    ArrowLeft, 
    Eye, 
    EyeOff, 
    Loader2, 
    Lock, 
    Mail, 
    Shield, 
    Workflow, 
    ArrowRight, 
    User, 
    Zap, 
    CheckCircle,
    ChevronRight,
    Star,
    Sparkles,
    ShieldCheck,
    Quote,
    Globe
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

function SignUpFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get('step');
  const [step, setStep] = useState(stepParam ? parseInt(stepParam) : 1); 

  useEffect(() => {
    if (stepParam) {
        const s = parseInt(stepParam);
        if (!isNaN(s) && s !== step) {
            setStep(s);
        }
    }
  }, [stepParam]);

  const updateStep = (newStep: number) => {
    setStep(newStep);
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', newStep.toString());
    router.push(`/signup?${params.toString()}`);
  };

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const { setAuth, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && step === 1) {
        updateStep(2);
    }
  }, [isAuthenticated, step]);

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

      toast({
        title: "Account Created!",
        description: "Now, please select a plan to get started.",
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

  const selectPlan = async (planId: string) => {
    try {
      setIsLoading(true);
      if (planId === 'starter') {
        await api.post('/user/billing/select-free');
        toast({
          title: "Plan Activated",
          description: "Your free starter plan is active! Now let's add your first website.",
        });
        updateStep(3);
      } else {
        const response = await api.post('/user/billing/checkout', { plan: planId });
        if (response.data.data.checkoutUrl) {
          window.location.href = response.data.data.checkoutUrl;
        }
      }
    } catch (error: any) {
      toast({
        title: "Activation Failed",
        description: error.message || "Could not activate plan",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebsiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteData.siteName.trim() || !websiteData.siteUrl.trim()) {
        setError('Please fill in all website details');
        return;
    }

    try {
        setIsLoading(true);
        const normalizedUrl = websiteData.siteUrl.startsWith('http') ? websiteData.siteUrl : `https://${websiteData.siteUrl}`;
        await api.post('/user/websites', { 
            name: websiteData.siteName.trim(), 
            url: normalizedUrl 
        });

        toast({
            title: "Success!",
            description: "Your website has been added. Welcome to Seentics!",
        });

        router.push('/websites');
    } catch (error: any) {
        setError(error.message || 'Failed to add website');
    } finally {
        setIsLoading(false);
    }
  };

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '$0',
      description: 'Side projects & hobbyists',
      features: ['1 Website', '5,000 Events', '1 Automation', '1 Funnel', 'Basic Reports'],
      buttonText: 'Get Started',
      accent: 'blue'
    },
    {
      id: 'growth',
      name: 'Growth',
      price: '$19',
      description: 'Scaling startups & SaaS',
      features: ['5 Websites', '100,000 Events', '10 Automations', '10 Funnels', 'Custom Goals', 'Email Support'],
      buttonText: 'Power Up',
      accent: 'indigo',
      popular: true
    },
    {
      id: 'scale',
      name: 'Scale',
      price: '$49',
      description: 'Agencies & Enterprises',
      features: ['Unlimited Sites', '300,000 Events', '30 Automations', '30 Funnels', 'Advanced API', 'Priority Support'],
      buttonText: 'Go Global',
      accent: 'purple'
    }
  ];

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
            
            {/* Step Indicator - Refined Minimalist */}
            <div className="relative flex justify-between items-center h-10 px-4">
                <div className="absolute top-1/2 left-4 right-4 h-px bg-slate-100 dark:bg-slate-800 -translate-y-1/2" />
                <motion.div 
                    initial={false}
                    animate={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
                    className="absolute top-1/2 left-4 h-[2px] bg-primary -translate-y-1/2 transition-all duration-1000 ease-in-out shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                    style={{ maxWidth: 'calc(100% - 32px)' }}
                />

                {[
                    { id: 1, label: 'Signup' },
                    { id: 2, label: 'Plans' },
                    { id: 3, label: 'Add Website' }
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
                            <p className="text-muted-foreground font-medium">Join the elite Seentics ecosystem.</p>
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
                ) : step === 2 ? (
                    <motion.div 
                        key="plans"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.5 }}
                        className="w-full max-w-5xl"
                    >
                        <div className="mb-12 text-center">
                            <h2 className="text-4xl font-black tracking-tight mb-4 text-slate-900 dark:text-white">Choose plan.</h2>
                            <p className="text-slate-500 font-medium">Select the engine that fits your mission.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {plans.map((plan, i) => (
                                <motion.div
                                    key={plan.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className={`relative p-8 rounded-xl border transition-all duration-500 overflow-hidden group ${
                                        plan.popular 
                                        ? 'bg-slate-900 border-border text-white shadow-2xl scale-105 z-10' 
                                        : 'bg-card border-border hover:border-primary/50'
                                    }`}
                                >
                                    {plan.popular && (
                                        <div className="absolute top-6 right-6 px-3 py-1 bg-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                                            Popular
                                        </div>
                                    )}

                                    <div className="mb-8">
                                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${plan.popular ? 'text-primary' : 'text-slate-400'}`}>
                                            {plan.name}
                                        </p>
                                        <div className="flex items-baseline gap-1">
                                            <h3 className="text-5xl font-black">{plan.price}</h3>
                                            <span className="text-sm font-bold opacity-40">/mo</span>
                                        </div>
                                        <p className={`mt-4 text-xs font-medium leading-relaxed ${plan.popular ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {plan.description}
                                        </p>
                                    </div>

                                    <div className="space-y-4 mb-10">
                                        {plan.features.map((f, idx) => (
                                            <div key={idx} className="flex items-center gap-3">
                                                <div className={`h-5 w-5 rounded-full flex items-center justify-center ${plan.popular ? 'bg-primary/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                                    <CheckCircle className={`h-3 w-3 ${plan.popular ? 'text-primary' : 'text-slate-500'}`} />
                                                </div>
                                                <span className={`text-[13px] font-bold ${plan.popular ? 'text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}>{f}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        onClick={() => selectPlan(plan.id)}
                                        disabled={isLoading}
                                        className={`w-full h-16 rounded-xl font-bold text-lg transition-all active:scale-95 ${
                                            plan.popular 
                                                ? 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25' 
                                                : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white'
                                        }`}
                                    >
                                        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : plan.buttonText}
                                    </Button>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div 
                        key="website"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-lg bg-slate-800 rounded-xl p-8 border border-slate-700/50 shadow-2xl"
                    >
                        <div className="mb-10 text-center">
                            <h2 className="text-4xl font-black tracking-tight mb-3">Add Website.</h2>
                            <p className="text-slate-500 font-medium">Define your first target domain for tracking.</p>
                        </div>

                        <form onSubmit={handleWebsiteSubmit} className="space-y-6">
                            {error && (
                                <div className="p-4 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Website Name</label>
                                    <div className="relative group">
                                        <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                        <Input
                                            placeholder="My Awesome App"
                                            value={websiteData.siteName}
                                            onChange={(e) => setWebsiteData({...websiteData, siteName: e.target.value})}
                                            className="h-14 pl-12 bg-slate-900 border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Website URL</label>
                                    <div className="relative group">
                                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                        <Input
                                            placeholder="example.com"
                                            value={websiteData.siteUrl}
                                            onChange={(e) => setWebsiteData({...websiteData, siteUrl: e.target.value})}
                                            className="h-14 pl-12 bg-slate-900 border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                            >
                                {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                    <span className="flex items-center gap-2">
                                        Finalize setup <ArrowRight size={18} />
                                    </span>
                                )}
                            </Button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#020617]">
            <Loader2 className="animate-spin h-10 w-10 text-primary mb-4" />
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Loading Flow...</p>
        </div>
    }>
      <SignUpFlow />
    </Suspense>
  );
}
