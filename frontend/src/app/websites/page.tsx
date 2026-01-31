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
          <p className="text-muted-foreground font-black uppercase tracking-widest text-xs opacity-60">Initializing Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] selection:bg-primary/20 transition-all duration-500 flex flex-col items-center justify-center p-8 overflow-y-auto custom-scrollbar relative">
      
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
        </div>

        <div className="relative z-10 w-full flex flex-col items-center justify-center">
            <div className="w-full max-w-lg">
                <AnimatePresence mode="wait">
                    {!newlyCreatedSiteId ? (
                        <motion.div
                            key="add-form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5 }}
                            className="bg-slate-800 p-8 rounded-xl border border-slate-700/50 shadow-2xl"
                        >
                            <div className="mb-10 text-center">
                                <h2 className="text-4xl font-black tracking-tight mb-3">Add Website.</h2>
                                <p className="text-slate-500 font-medium">Define your target domain for tracking.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-1.5 ">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Website Name</label>
                                        <div className="relative group">
                                            <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                            <Input
                                                placeholder="My Awesome App"
                                                value={name}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
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
                                                value={url}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                                                className="h-14 pl-12 bg-slate-900 border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                                required
                                            />
                                        </div>
                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest ml-1 opacity-40">
                                            Exclude protocols (e.g., mysite.com)
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full h-15 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest rounded shadow-xl transition-all active:scale-[0.98]"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                        <span className="flex items-center gap-2">
                                            Create and Track <ArrowRight size={18} />
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
                            className="bg-slate-800 p-8 rounded-xl border border-slate-700/50 shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                            
                            <div className="mb-10 text-center">
                                <div className="flex items-center justify-center gap-3 text-emerald-500 mb-4">
                                    <CheckCircle size={32} />
                                    <h2 className="text-3xl font-black text-white tracking-tight">Setup Complete!</h2>
                                </div>
                                <p className="text-slate-400 font-bold leading-relaxed">
                                    Your website <span className="text-primary font-black">{name}</span> is ready. Add the tracking script to your site's <span className="text-white font-black italic">{'<head>'}</span> section.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Tracking Snippet</span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={copyToClipboard}
                                        className="h-8 px-4 rounded bg-primary/10 hover:bg-primary/20 text-primary font-black uppercase tracking-widest text-[9px] transition-all"
                                    >
                                        {copied ? 'Copied Snippet!' : 'Copy Snippet'}
                                    </Button>
                                </div>
                                <div className="relative group">
                                    <pre className="p-6 rounded bg-slate-900 border border-slate-700/50 text-[11px] font-mono leading-relaxed overflow-x-auto text-slate-300 shadow-inner custom-scrollbar">
                                        <code>{trackingCode}</code>
                                    </pre>
                                </div>
                            </div>

                            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Button 
                                    className="h-14 bg-primary hover:bg-primary/90 text-white rounded font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20"
                                    onClick={() => router.push(`/websites/${newlyCreatedSiteId}`)}
                                >
                                    Dashboard
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="h-14 bg-slate-900 border-none hover:bg-slate-900/80 text-white rounded font-black uppercase tracking-widest text-xs"
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

        <div className="mt-12 text-center">
             <Link href="/">
                <Button variant="ghost" size="sm" className="text-slate-500 font-black uppercase tracking-widest text-[10px] hover:bg-transparent hover:text-primary transition-colors px-0 group">
                    <ArrowLeft size={16} className="mr-3 group-hover:-translate-x-1 transition-transform" />
                    Back to Explorer
                </Button>
            </Link>
        </div>
    </div>
  );
}