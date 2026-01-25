'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getWebsites, addWebsite } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { Loader2, ArrowLeft, ArrowRight, Shield, Workflow, CheckCircle, Copy, Code, Sparkles, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/ui/logo';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function WebsitesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newlyCreatedSiteId, setNewlyCreatedSiteId] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const redirectToWebsite = async () => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const websites = await getWebsites();
        if (websites.length > 0 && !newlyCreatedSiteId) {
          router.push(`/websites/${websites[0].id}`);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching websites:', error);
        setIsLoading(false);
      }
    };

    redirectToWebsite();
  }, [user, router, newlyCreatedSiteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !url.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid website URL',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id) return;

    setIsSubmitting(true);

    try {
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      const website = await addWebsite({ name: name.trim(), url: normalizedUrl }, user.id);
      
      setNewlyCreatedSiteId(website.id);
      const code = `<script async src="${window.location.origin}/trackers/tracker.js" data-site-id="${website.id}"></script>`;
      setTrackingCode(code);

      toast({
        title: 'Success!',
        description: `${name} has been added successfully`,
      });
    } catch (error: any) {
      console.error('Error adding website:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add website. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Tracking code copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
       toast({ title: 'Error', description: 'Failed to copy code', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left Column: Branding Section */}
      <div className="hidden lg:flex flex-col justify-between p-12 w-full max-w-lg bg-slate-50 dark:bg-slate-950 relative overflow-hidden border-r border-slate-200 dark:border-white/5">
        <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[100px] animate-pulse delay-700" />
        </div>

        <div className="relative z-10">
          <Link href="/">
            <Logo size="xl" showText={true} textClassName="text-2xl font-bold text-slate-900 dark:text-white" />
          </Link>
          
          <div className="mt-20">
            <h1 className="text-4xl font-black tracking-tight mb-6 leading-tight text-slate-900 dark:text-white">
              Launch your <br />
              <span className="text-primary italic">Intelligence Engine.</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg font-medium leading-relaxed max-w-md">
              Add your first website to start tracking visitors in real-time. Experience the power of privacy-first analytics.
            </p>
          </div>
        </div>

        <div className="relative z-10">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/5 dark:bg-white/5 border border-primary/10 dark:border-white/10 flex items-center justify-center text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Instant Insights</p>
                <p className="text-xs text-slate-500">Live data streaming as it happens.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-white/5 border border-indigo-100 dark:border-white/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Code className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Easy Installation</p>
                <p className="text-xs text-slate-500">Just one line of code to deploy.</p>
              </div>
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
            <div className="w-full max-w-xl">
                <AnimatePresence mode="wait">
                    {!newlyCreatedSiteId ? (
                        <motion.div
                            key="add-form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <div className="mb-8 text-center md:text-left">
                                <h2 className="text-3xl font-black tracking-tight mb-2 text-slate-900 dark:text-white">Add Website</h2>
                                <p className="text-muted-foreground font-medium">
                                    Start tracking your first domain with Seentics.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-sm font-bold">Website Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="My Awesome Site"
                                        value={name}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                                        disabled={isSubmitting}
                                        className="h-14 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-primary rounded-2xl"
                                        required
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="url" className="text-sm font-bold">Website URL</Label>
                                    <Input
                                        id="url"
                                        type="text"
                                        placeholder="https://example.com"
                                        value={url}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                                        disabled={isSubmitting}
                                        className="h-14 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-primary rounded-2xl"
                                        required
                                    />
                                    <p className="text-[10px] text-muted-foreground font-medium italic">
                                        Exclude protocols if you like (e.g., example.com)
                                    </p>
                                </div>

                                <Button 
                                    type="submit" 
                                    variant="brand"
                                    className="w-full h-14 text-base font-black shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all rounded-2xl active:scale-[0.98]" 
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Initializing Engine...
                                        </>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            Create and Track
                                            <ArrowRight size={18} />
                                        </span>
                                    )}
                                </Button>
                            </form>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="tracking-code"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-slate-50 dark:bg-slate-900/50 p-8 md:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-indigo-500 to-primary" />
                            
                            <div className="mb-8">
                                <div className="flex items-center gap-3 text-green-600 mb-4">
                                    <CheckCircle size={28} />
                                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Setup Complete!</h2>
                                </div>
                                <p className="text-muted-foreground font-medium leading-relaxed">
                                    Your website <span className="text-foreground font-bold">{name}</span> is ready. Now add the tracking script to your site's <span className="text-foreground font-bold italic">{'<head>'}</span> section.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Tracking Code</span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={copyToClipboard}
                                        className="h-8 px-3 rounded-lg hover:bg-primary/10 text-primary font-bold"
                                    >
                                        {copied ? 'Copied!' : 'Copy Snippet'}
                                    </Button>
                                </div>
                                <div className="relative group">
                                    <pre className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono leading-relaxed overflow-x-auto text-slate-900 dark:text-slate-300 shadow-inner">
                                        <code>{trackingCode}</code>
                                    </pre>
                                </div>
                            </div>

                            <div className="mt-10 flex flex-col sm:flex-row gap-4">
                                <Button 
                                    variant="brand" 
                                    className="flex-1 h-12 rounded-xl font-bold"
                                    onClick={() => router.push(`/websites/${newlyCreatedSiteId}`)}
                                >
                                    Go to Dashboard
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="flex-1 h-12 rounded-xl font-bold bg-transparent"
                                    onClick={() => setNewlyCreatedSiteId(null)}
                                >
                                    Add Another
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
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