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
    ArrowRight, 
    ShieldCheck, 
    Quote 
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';
import { motion } from 'framer-motion';

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
                    Elite Intelligence. <br />
                    <span className="text-primary italic">Absolute Control.</span>
                </motion.h1>
                <motion.p 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-slate-400 text-xl font-medium leading-relaxed"
                >
                    Reconnect with your data empire. Our privacy-first engine is ready to deploy your latest insights.
                </motion.p>
            </div>
         </div>

        
      </div>

      {/* --- RIGHT COLUMN: SIGNIN FLOW --- */}
      <div className="relative flex flex-col p-8 md:p-16 overflow-y-auto custom-scrollbar">
        
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between mb-12">
            <Link href="/" className="flex items-center gap-2">
                <Logo size="lg" />
                <span className="text-xl font-black tracking-tight">SEENTICS</span>
            </Link>
            <Link href="/signup">
                <Button variant="ghost" className="font-bold text-sm">Sign Up</Button>
            </Link>
        </div>

        {/* Desktop Top Nav Overlay */}
        <div className="hidden lg:flex justify-end mb-12">
            <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-400">New to Seentics?</span>
                <Link href="/signup">
                    <Button variant="outline" className="h-11 px-6 font-black text-xs uppercase tracking-widest rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">Create Account</Button>
                </Link>
            </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
            
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-lg bg-slate-800 rounded-md p-6"
            >
                <div className="mb-10 text-center lg:text-left">
                    <h2 className="text-4xl font-black tracking-tight mb-3">Welcome back.</h2>
                    <p className="text-slate-500 font-medium">Log in to resume your data transmission.</p>
                </div>

                <form onSubmit={handleEmailSignIn} className="space-y-6">
                    {error && (
                        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-1.5 px-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</label>
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
                            <div className="flex justify-between items-center pr-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security Phrase</label>
                                <Link href="/forgot-password"  className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest">
                                    Forgot?
                                </Link>
                            </div>
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
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-slate-900 dark:bg-primary hover:bg-slate-800 dark:hover:bg-primary/90 text-white font-black  uppercase tracking-widest rounded-xl shadow-xl shadow-slate-200/50 dark:shadow-none transition-all active:scale-[0.98]"
                    >
                        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                            <span className="flex items-center gap-2">
                                Sign In <ArrowRight size={18} />
                            </span>
                        )}
                    </Button>
                </form>

                <div className="mt-12 text-center lg:text-left">
                     <p className="text-xs text-slate-400 font-medium">
                        By signing in, you agree to our terms of service and recognize our privacy commitment.
                     </p>
                </div>
            </motion.div>
        </div>

        
      </div>
    </div>
  );
}
