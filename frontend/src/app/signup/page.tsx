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
    Quote
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

export default function SignUpPage() {
  const [step, setStep] = useState(1); // 1: Account, 2: Plan Selection
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

      setStep(2);

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
          description: "Your free starter plan is now active!",
        });
        router.push('/websites');
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

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '$0',
      description: 'Side projects & hobbyists',
      features: ['1 Website', '5,000 Events', 'Basic Reports'],
      buttonText: 'Get Started',
      accent: 'blue'
    },
    {
      id: 'growth',
      name: 'Growth',
      price: '$19',
      description: 'Scaling startups & SaaS',
      features: ['5 Websites', '50,000 Events', 'Custom Goals', 'Email Support'],
      buttonText: 'Power Up',
      accent: 'indigo',
      popular: true
    },
    {
      id: 'scale',
      name: 'Scale',
      price: '$49',
      description: 'Agencies & Enterprises',
      features: ['Unlimited Sites', '250,000 Events', 'Advanced API', 'Priority Support'],
      buttonText: 'Go Global',
      accent: 'purple'
    }
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white dark:bg-[#020617] selection:bg-primary/20">
      
      {/* --- LEFT COLUMN: IMMERSIVE BRANDING --- */}
      <div className="relative hidden lg:flex flex-col justify-between p-16 bg-[#0B0F1A] overflow-hidden">
         {/* Background Visuals */}
         <div className="absolute inset-0 z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-500/10 rounded-full blur-[100px] animate-pulse delay-1000" />
            
            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none" />
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
         </div>

         <div className="relative z-10">
            <Link href="/" className="flex items-center gap-3 group">
                <Logo size="xl" />
                <span className="text-2xl font-black tracking-tighter text-white group-hover:text-primary transition-colors">SEENTICS</span>
            </Link>

            <div className="mt-24 max-w-lg">
                <motion.h1 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-6xl font-black tracking-tight text-white leading-[1.1] mb-8"
                >
                    Predict the <br />
                    <span className="text-primary italic">Unpredictable.</span>
                </motion.h1>
                <motion.p 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-slate-400 text-xl font-medium leading-relaxed"
                >
                    Don't just track data. Understand behavior. Seentics brings elite-level intelligence to every interaction.
                </motion.p>
            </div>
         </div>

         <div className="relative z-10">
            {/* Testimonial / Social Proof Card */}
            <div className="p-8 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-md max-w-md">
                <Quote className="text-primary h-8 w-8 mb-6 opacity-50" />
                <p className="text-lg font-bold text-slate-200 leading-relaxed mb-6">
                    "Since switching to Seentics, our conversion rates increased by 40% through automated behavioral insights."
                </p>
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center font-black text-white">
                        JD
                    </div>
                    <div>
                        <p className="text-sm font-black text-white">Jonas Darrick</p>
                        <p className="text-xs font-bold text-slate-500">CTO @ HyperLog</p>
                    </div>
                </div>
            </div>

            <div className="mt-12 flex items-center gap-8 opacity-40 grayscale contrast-125">
                <span className="text-2xl font-black italic tracking-tighter text-white">TECHLEAP</span>
                <span className="text-2xl font-black italic tracking-tighter text-white">FLUX</span>
                <span className="text-2xl font-black italic tracking-tighter text-white">ORBIT</span>
            </div>
         </div>
      </div>

      {/* --- RIGHT COLUMN: AUTH FLOW --- */}
      <div className="relative flex flex-col p-8 md:p-16 overflow-y-auto custom-scrollbar">
        
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between mb-12">
            <Link href="/" className="flex items-center gap-2">
                <Logo size="lg" />
                <span className="text-xl font-black tracking-tight">SEENTICS</span>
            </Link>
            <Link href="/signin">
                <Button variant="ghost" className="font-bold text-sm">Sign In</Button>
            </Link>
        </div>

        {/* Desktop Top Nav Overlay */}
        <div className="hidden lg:flex justify-end mb-12">
            <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-400">Already have an account?</span>
                <Link href="/signin">
                    <Button variant="outline" className="h-11 px-6 font-black text-xs uppercase tracking-widest rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">Sign In</Button>
                </Link>
            </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
            
            {/* Step Indicator - Refined Minimalist */}
            <div className="w-full max-w-md mb-16 px-4">
                <div className="relative flex justify-between items-center h-10">
                    <div className="absolute top-1/2 left-0 w-full h-px bg-slate-100 dark:bg-slate-800 -translate-y-1/2" />
                    <motion.div 
                        initial={false}
                        animate={{ width: step === 1 ? '50%' : '100%' }}
                        className="absolute top-1/2 left-0 h-[2px] bg-primary -translate-y-1/2 transition-all duration-1000 ease-in-out shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                    />

                    {[
                        { id: 1, label: 'Identity' },
                        { id: 2, label: 'Ascend' }
                    ].map((s) => (
                        <div key={s.id} className="relative z-10 flex flex-col items-center">
                            <motion.div 
                                animate={{ 
                                    scale: step === s.id ? 1.1 : 1,
                                    backgroundColor: step >= s.id ? 'var(--primary)' : 'var(--background)',
                                    borderColor: step >= s.id ? 'var(--primary)' : 'rgb(226, 232, 240)'
                                }}
                                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all duration-700 ${
                                    step >= s.id ? 'text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-300 shadow-sm'
                                }`}
                            >
                                {step > s.id ? <CheckCircle className="h-3.5 w-3.5" /> : <span className="text-[10px] font-black">{s.id}</span>}
                            </motion.div>
                            <span className={`absolute top-8 text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 whitespace-nowrap ${
                                step === s.id ? 'text-primary' : 'text-slate-400 opacity-60'
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

            <AnimatePresence mode="wait">
                {step === 1 ? (
                    <motion.div 
                        key="account"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.5 }}
                        className="w-full max-w-md"
                    >
                        <div className="mb-10 text-center lg:text-left">
                            <h2 className="text-4xl font-black tracking-tight mb-3">Begin your journey.</h2>
                            <p className="text-slate-500 font-medium">Create your elite Seentics account in seconds.</p>
                        </div>

                        <form onSubmit={handleAccountSubmit} className="space-y-6">
                            {error && (
                                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold font-sans">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-1.5 px-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Access Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                        <Input
                                            name="name"
                                            placeholder="Elon Musk"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            className="h-14 pl-12 bg-slate-50 border-none dark:bg-slate-900/50 rounded-2xl font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5 px-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transmission Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                        <Input
                                            name="email"
                                            type="email"
                                            placeholder="elon@x.com"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            className="h-14 pl-12 bg-slate-50 border-none dark:bg-slate-900/50 rounded-2xl font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5 px-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security Phrase</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                            <Input
                                                name="password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                value={formData.password}
                                                onChange={handleInputChange}
                                                className="h-14 pl-12 pr-12 bg-slate-50 border-none dark:bg-slate-900/50 rounded-2xl font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                                required
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                            <Input
                                                name="confirmPassword"
                                                type={showConfirmPassword ? "text" : "password"}
                                                placeholder="Confirm"
                                                value={formData.confirmPassword}
                                                onChange={handleInputChange}
                                                className="h-14 pl-12 bg-slate-50 border-none dark:bg-slate-900/50 rounded-2xl font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-15 bg-slate-900 dark:bg-primary hover:bg-slate-800 dark:hover:bg-primary/90 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none transition-all active:scale-[0.98]"
                            >
                                {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                    <span className="flex items-center gap-2">
                                        Establish Access <ArrowRight size={18} />
                                    </span>
                                )}
                            </Button>
                        </form>
                    </motion.div>
                ) : (
                    <motion.div 
                        key="plans"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="w-full max-w-5xl"
                    >
                        <div className="mb-12 text-center">
                            <h2 className="text-4xl font-black tracking-tight mb-4">Choose your thrust.</h2>
                            <p className="text-slate-500 font-medium">Activate the engine that fits your mission.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {plans.map((plan, i) => (
                                <motion.div
                                    key={plan.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className={`relative p-8 rounded-[3rem] border transition-all duration-500 overflow-hidden group ${
                                        plan.popular 
                                        ? 'bg-slate-900 border-slate-800 text-white shadow-2xl' 
                                        : 'bg-white dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 hover:border-primary/50'
                                    }`}
                                >
                                    {plan.popular && (
                                        <div className="absolute top-6 right-6 px-3 py-1 bg-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                                            Peak Performance
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
                                                <div className={`h-5 w-5 rounded-full flex items-center justify-center ${plan.popular ? 'bg-primary/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                    <CheckCircle className={`h-3 w-3 ${plan.popular ? 'text-primary' : 'text-slate-500'}`} />
                                                </div>
                                                <span className={`text-[13px] font-bold ${plan.popular ? 'text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>{f}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        onClick={() => selectPlan(plan.id)}
                                        disabled={isLoading}
                                        className={`w-full h-15 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 ${
                                            plan.popular 
                                                ? 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25' 
                                                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black'
                                        }`}
                                    >
                                        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : plan.buttonText}
                                    </Button>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {/* Footer Overlay */}
        <div className="mt-12 pt-12 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center md:text-left">
                © 2026 SEENTICS ANALYTICS. ALL RIGHTS RESERVED.
            </p>
            <div className="flex items-center gap-6">
                <Link href="/privacy" className="text-[10px] font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest">Privacy</Link>
                <Link href="/terms" className="text-[10px] font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest">Terms</Link>
            </div>
        </div>
      </div>
    </div>
  );
}
