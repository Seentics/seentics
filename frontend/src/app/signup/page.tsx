'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, Shield, Workflow, ArrowRight, User, Zap, CheckCircle } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignUpPage() {
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


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1()) return;

    try {
      setError(null);
      setIsLoading(true);

      // 1. Register the user
      await api.post('/user/auth/register', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      // 2. Login to get tokens
      const loginResponse = await api.post('/user/auth/login', {
        email: formData.email.trim(),
        password: formData.password,
      });

      const authData = loginResponse.data.data;
      
      // Update Auth Store
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
        description: "Welcome to Seentics. Let's add your first website.",
      });

      router.push('/websites');

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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left Column: Branding Section */}
      <div className="hidden lg:flex flex-col justify-between p-12 w-full max-w-lg bg-blue-50 dark:bg-slate-950 relative overflow-hidden border-r border-blue-100 dark:border-white/5">
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
              Scale without <br />
              <span className="text-primary italic">Boundaries.</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg font-medium leading-relaxed max-w-md">
                Get the most powerful analytics engine on the market. Start for free, upgrade when you're ready to win.
            </p>
          </div>
        </div>

        <div className="relative z-10">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-white/50 dark:bg-white/5 border border-indigo-100 dark:border-white/10 flex items-center justify-center text-primary">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Real-time Dashboard</p>
                <p className="text-xs text-slate-500">Zero-latency event streaming.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-white/50 dark:bg-white/5 border border-indigo-100 dark:border-white/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">One-Click Install</p>
                <p className="text-xs text-slate-500">Under 2KB script size.</p>
              </div>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-blue-100 dark:border-white/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-600 mb-4">Empowering next-gen data teams</p>
            <div className="flex items-center gap-4 opacity-40 grayscale saturate-0 text-slate-900 dark:text-white">
                <span className="text-xl font-black italic tracking-tighter">CLOUDCORE</span>
                <span className="text-xl font-black italic tracking-tighter">NEXUS</span>
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

        <div className="lg:hidden mb-8 self-center">
             <Link href="/">
                <Logo size="xl" showText={true} textClassName="text-2xl font-bold text-slate-900 dark:text-white" />
            </Link>
        </div>

        <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center md:text-left">
                    <h2 className="text-3xl font-black tracking-tight mb-2 text-slate-900 dark:text-white">Create account</h2>
                    <p className="text-muted-foreground font-medium">
                        Join 5,000+ developers and start tracking today.
                    </p>
                </div>

                {error && (
                  <Alert variant="destructive" className="mb-6 rounded-2xl border-0 bg-red-500/10 text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="font-bold">{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      name="name"
                      placeholder="Full name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="h-14 pl-12 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-primary text-slate-900 dark:text-white rounded-2xl transition-all"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      name="email"
                      type="email"
                      placeholder="Email address"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="h-14 pl-12 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-primary text-slate-900 dark:text-white rounded-2xl transition-all"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
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

                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm password"
                        value={formData.confirmPassword}
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
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </Button>
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground text-center px-4 font-medium italic">
                    Min. 8 chars with uppercase, lowercase, and one number.
                  </p>

                  <Button
                    type="submit"
                    variant='brand'
                    className="w-full h-14 text-base font-black shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all rounded-2xl active:scale-[0.98]"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating your console...
                      </>
                    ) : (
                        <span className="flex items-center gap-2">
                            Create Account
                            <ArrowRight size={18} />
                        </span>
                    )}
                  </Button>
                </form>

                <div className="mt-8 text-center md:text-left">
                  <p className="text-sm text-muted-foreground font-medium">
                    Already have an account?{' '}
                    <Link href="/signin" className="text-primary hover:underline font-black">
                      Sign in
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
