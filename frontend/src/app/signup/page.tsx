'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, CheckCircle, Mail, Lock, User, Globe, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { addWebsite } from '@/lib/websites-api';

export default function SignUpPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    websiteName: '',
    websiteUrl: ''
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

  const validateStep2 = () => {
    if (!formData.websiteName.trim()) {
      setError('Website name is required');
      return false;
    }
    if (!formData.websiteUrl.trim()) {
      setError('Website URL is required');
      return false;
    }
    try {
        new URL(formData.websiteUrl.startsWith('http') ? formData.websiteUrl : `https://${formData.websiteUrl}`);
    } catch (e) {
        setError('Please enter a valid website URL');
        return false;
    }
    return true;
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
      setError(null);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;

    try {
      setError(null);
      setIsLoading(true);

      // 1. Register the user
      const regResponse = await api.post('/user/auth/register', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      // 2. Login to get tokens (assuming register doesn't return tokens directly)
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

        // 3. Add the first website
        try {
            await addWebsite({
                name: formData.websiteName.trim(),
                url: formData.websiteUrl.trim()
            }, authData.user.id);
        } catch (wsError) {
            console.error('Failed to add initial website:', wsError);
            // We don't block the whole process if website creation fails, 
            // the user can add it later, but we should notify them.
        }
      }

      toast({
        title: "Account Created!",
        description: "Welcome to Seentics. Your dashboard is ready.",
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
            <div className="flex items-center justify-between mb-2">
                <span className={`h-1.5 flex-1 rounded-full mx-1 ${step >= 1 ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`} />
                <span className={`h-1.5 flex-1 rounded-full mx-1 ${step >= 2 ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`} />
            </div>
            <CardTitle className="text-2xl font-bold text-center">
                {step === 1 ? 'Create account' : 'Setup your website'}
            </CardTitle>
            <CardDescription className="text-center">
                {step === 1 ? 'Join Seentics and get started today' : 'Add your first website to start tracking'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === 1 ? (
              <form onSubmit={handleNextStep} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="name"
                    placeholder="Full name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="h-12 pl-10 bg-slate-50 dark:bg-slate-900 border-0 focus-visible:ring-1"
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="email"
                    type="email"
                    placeholder="Email address"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="h-12 pl-10 bg-slate-50 dark:bg-slate-900 border-0 focus-visible:ring-1"
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="h-12 pl-10 pr-10 bg-slate-50 dark:bg-slate-900 border-0 focus-visible:ring-1"
                      disabled={isLoading}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-12 px-3 hover:bg-transparent text-slate-400"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="h-12 pl-10 pr-10 bg-slate-50 dark:bg-slate-900 border-0 focus-visible:ring-1"
                      disabled={isLoading}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-12 px-3 hover:bg-transparent text-slate-400"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground text-center px-4">
                  Minimum 8 characters with at least one uppercase, one lowercase, and one number.
                </p>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all rounded-xl"
                  disabled={isLoading}
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleFinalSubmit} className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="websiteName"
                    placeholder="Website Name (e.g. My Awesome Blog)"
                    value={formData.websiteName}
                    onChange={handleInputChange}
                    className="h-12 pl-10 bg-slate-50 dark:bg-slate-900 border-0 focus-visible:ring-1"
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="websiteUrl"
                    placeholder="Website URL (e.g. myblog.com)"
                    value={formData.websiteUrl}
                    onChange={handleInputChange}
                    className="h-12 pl-10 bg-slate-50 dark:bg-slate-900 border-0 focus-visible:ring-1"
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                    <Button
                        type="button"
                        variant="secondary"
                        className="flex-1 h-12 rounded-xl"
                        onClick={() => setStep(1)}
                        disabled={isLoading}
                    >
                        Back
                    </Button>
                    <Button
                        type="submit"
                        className="flex-[2] h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all rounded-xl"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Setting up...
                            </>
                        ) : (
                            'Complete Setup'
                        )}
                    </Button>
                </div>
              </form>
            )}

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/signin" className="text-primary hover:underline font-semibold">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
             <Link href="/">
                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to home
                </Button>
            </Link>
        </div>
      </div>
    </div>
  );
}
