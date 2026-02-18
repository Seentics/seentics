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
import { isEnterprise } from '@/lib/features';

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
    <div className="min-h-screen bg-transparent selection:bg-primary/20 flex items-center justify-center p-6">
        
        {/* Background Visuals */}
        <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full animate-pulse delay-1000" />
        </div>

        <div className="relative z-10 w-full max-w-lg">
            <div className="mb-12 text-center">
                <Link href="/" className="inline-flex items-center gap-3 group mb-8">
                    <Logo size="xl" />
                    <span className="text-2xl font-black tracking-tighter group-hover:text-primary transition-colors text-foreground">SEENTICS</span>
                </Link>
                <h2 className="text-4xl font-black tracking-tight mb-3 text-foreground">Welcome back.</h2>
                <p className="text-muted-foreground font-medium">Log in to resume your data transmission.</p>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-card rounded-xl p-8 shadow-2xl shadow-indigo-500/10 border border-border/50"
            >
                <form onSubmit={handleEmailSignIn} className="space-y-6">
                    {error && (
                        <div className="p-4 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-1.5 ">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address</label>
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
                            <div className="flex justify-between items-center pr-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Security Phrase</label>
                                <Link href="/forgot-password"  className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest">
                                    Forgot?
                                </Link>
                            </div>
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
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-16 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                    >
                        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                            <span className="flex items-center gap-2">
                                Sign in <ArrowRight size={18} />
                            </span>
                        )}
                    </Button>
                </form>

                <div className="mt-8 pt-8 border-t border-border/50 text-center">
                    <p className="text-sm font-medium text-muted-foreground">
                        {isEnterprise ? (
                            <>New to Seentics?{' '}
                                <Link href="/signup" className="text-primary font-black hover:underline uppercase tracking-widest text-xs">
                                    Create Account
                                </Link>
                            </>
                        ) : (
                            <>First time?{' '}
                                <Link href="/setup" className="text-primary font-black hover:underline uppercase tracking-widest text-xs">
                                    Set Up Admin
                                </Link>
                            </>
                        )}
                    </p>
                </div>
            </motion.div>
        </div>
    </div>
  );
}
