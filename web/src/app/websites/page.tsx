'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getWebsites, addWebsite } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { 
  Loader2, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  Copy, 
  Code, 
  Sparkles, 
  Zap,
  Globe,
  Layout
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/ui/logo';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function WebsitesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newlyAddedSiteId, setNewlyAddedSiteId] = useState<string | null>(null);
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
        if (websites.length > 0 && !newlyAddedSiteId) {
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
  }, [user, router, newlyAddedSiteId]);

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
      
      setNewlyAddedSiteId(website.id);
      const code = `<script async src="${window.location.origin}/trackers/seentics-core.js" data-site-id="${website.id}"></script>`;
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-6 text-primary" />
          <p className="text-muted-foreground font-medium animate-pulse">Loading your websites...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20 transition-all duration-500 flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto relative">
        {/* Background Visuals */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full opacity-50" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-sky-500/10 blur-[100px] rounded-full opacity-50" />
        </div>

        <div className="relative z-10 w-full max-w-lg mb-12 flex flex-col items-center">
            <Link href="/" className="flex items-center gap-2 group mb-2">
                <Logo size="lg" />
                <span className="text-2xl font-bold tracking-tight text-foreground">Seentics</span>
            </Link>
            <div className="h-1 w-12 bg-primary/20 rounded-full" />
        </div>

        <div className="relative z-10 w-full flex flex-col items-center justify-center">
            <div className="w-full max-w-lg">
                <AnimatePresence mode="wait">
                    {!newlyAddedSiteId ? (
                        <motion.div
                            key="add-form"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="bg-card/50 backdrop-blur-xl p-8 md:p-10 rounded-3xl border border-border/50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)]"
                        >
                            <div className="mb-8 text-center">
                                <h2 className="text-3xl font-bold tracking-tight mb-3">Connect your website</h2>
                                <p className="text-muted-foreground text-sm">Where should Seentics start tracking visitors?</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-foreground/70 ml-1">Friendly Name</label>
                                        <div className="relative group">
                                            <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input
                                                placeholder="e.g. My Personal Blog"
                                                value={name}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                                                className="h-12 pl-12 bg-background/50 border-border focus-visible:ring-primary/20 rounded-xl"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-foreground/70 ml-1">Website URL</label>
                                        <div className="relative group">
                                            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input
                                                placeholder="e.g. my-awesome-site.com"
                                                value={url}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                                                className="h-12 pl-12 bg-background/50 border-border focus-visible:ring-primary/20 rounded-xl"
                                                required
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground px-1">
                                            Domain only, protocol will be handled automatically.
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                        <span className="flex items-center gap-2">
                                            Add and Start Tracking <ArrowRight size={18} />
                                        </span>
                                    )}
                                </Button>
                            </form>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="tracking-code"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-card/50 backdrop-blur-xl p-8 md:p-10 rounded-3xl border border-border/50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] relative"
                        >
                            <div className="mb-8 text-center">
                                <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl mb-4">
                                    <CheckCircle size={32} />
                                </div>
                                <h2 className="text-3xl font-bold tracking-tight mb-2">Almost there!</h2>
                                <p className="text-muted-foreground text-sm">
                                    Add this snippet to the <span className="font-mono bg-muted px-1 rounded">{'<head>'}</span> of <span className="text-foreground font-semibold uppercase">{name}</span> to start collecting data.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-foreground/70">Tracking Snippet</span>
                                    <button
                                        onClick={copyToClipboard}
                                        className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline transition-all"
                                    >
                                        {copied ? 'Copied to clipboard!' : 'Copy to clipboard'}
                                    </button>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-primary/5 rounded-xl blur-lg group-hover:bg-primary/10 transition-colors" />
                                    <pre className="relative p-6 rounded-xl bg-slate-950 text-[11px] font-mono leading-relaxed overflow-x-auto text-slate-300 border border-white/5 shadow-inner">
                                        <code>{trackingCode}</code>
                                    </pre>
                                </div>
                            </div>

                            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Button 
                                    className="h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20"
                                    onClick={() => router.push(`/websites/${newlyAddedSiteId}`)}
                                >
                                    Go to Dashboard
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="h-12 bg-background/50 border-border hover:bg-accent text-foreground rounded-xl font-bold"
                                    onClick={() => setNewlyAddedSiteId(null)}
                                >
                                    Add Another
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>

        <div className="mt-8 text-center">
             <Link href="/">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground transition-colors group">
                    <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                    Back to Home
                </Button>
            </Link>
        </div>
    </div>
  );
}