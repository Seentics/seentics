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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-6 text-primary" />
          <p className="text-muted-foreground font-black uppercase tracking-widest text-xs opacity-60">Initializing Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left Column: Branding Section */}
      <div className="hidden lg:flex flex-col justify-between p-16 w-full max-w-xl bg-accent/5 relative overflow-hidden border-r border-border/40">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-500/5 rounded-full blur-[100px] animate-pulse delay-700" />
        </div>

        <div className="relative z-10">
          <Link href="/">
            <Logo size="xl" showText={true} textClassName="text-3xl font-black text-foreground tracking-tighter" />
          </Link>
          
          <div className="mt-32">
            <h1 className="text-5xl font-black tracking-tight mb-8 leading-[1.1] text-foreground">
              Launch your <br />
              <span className="text-primary italic">Intelligence Engine.</span>
            </h1>
            <p className="text-muted-foreground text-xl font-medium leading-relaxed max-w-md opacity-80">
              Add your first website to start tracking visitors in real-time. Experience the power of privacy-first analytics.
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
            <div className="flex items-center gap-5 group">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <p className="font-black text-sm text-foreground uppercase tracking-widest">Instant Insights</p>
                <p className="text-xs text-muted-foreground font-medium opacity-60 italic">Live data streaming as it happens.</p>
              </div>
            </div>
            <div className="flex items-center gap-5 group">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                <Code className="h-6 w-6" />
              </div>
              <div>
                <p className="font-black text-sm text-foreground uppercase tracking-widest">Easy Installation</p>
                <p className="text-xs text-muted-foreground font-medium opacity-60 italic">Just one line of code to deploy.</p>
              </div>
            </div>
        </div>
      </div>

      {/* Right Column: Form Section */}
      <div className="flex-1 flex flex-col relative overflow-hidden px-6 py-12 md:p-24 bg-background">
        <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center overflow-hidden -z-10">
            <div className="w-[800px] h-[800px] bg-primary/5 blur-[150px] rounded-full" />
        </div>

        <div className="lg:hidden mb-12 self-center">
             <Link href="/">
                <Logo size="xl" showText={true} textClassName="text-3xl font-black text-foreground tracking-tighter" />
            </Link>
        </div>

        <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-lg">
                <AnimatePresence mode="wait">
                    {!newlyCreatedSiteId ? (
                        <motion.div
                            key="add-form"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -30 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        >
                            <div className="mb-12 text-center md:text-left">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-3">Onboarding Flow</p>
                                <h2 className="text-4xl font-black tracking-tighter mb-4 text-foreground">Add Domain</h2>
                                <p className="text-muted-foreground font-medium text-lg leading-relaxed opacity-60">
                                    Start tracking your first domain with Seentics.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="space-y-3">
                                    <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-[0.15em] ml-1 opacity-60">Website Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="Seentics Analytics"
                                        value={name}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                                        disabled={isSubmitting}
                                        className="h-14 bg-accent/5 border-border/40 focus:border-primary/50 focus:ring-primary/20 rounded-2xl text-base font-bold px-6"
                                        required
                                    />
                                </div>
                                
                                <div className="space-y-3">
                                    <Label htmlFor="url" className="text-[10px] font-black uppercase tracking-[0.15em] ml-1 opacity-60">Website URL</Label>
                                    <Input
                                        id="url"
                                        type="text"
                                        placeholder="seentics.com"
                                        value={url}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                                        disabled={isSubmitting}
                                        className="h-14 bg-accent/5 border-border/40 focus:border-primary/50 focus:ring-primary/20 rounded-2xl text-base font-bold px-6"
                                        required
                                    />
                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest ml-1 opacity-30 mt-2">
                                        Exclude protocols (e.g., app.seentics.com)
                                    </p>
                                </div>

                                <Button 
                                    type="submit" 
                                    variant="brand"
                                    className="w-full h-16 text-lg font-black shadow-2xl shadow-primary/20 hover:shadow-primary/30 transition-all rounded-2xl active:scale-[0.98] mt-4" 
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                                            Initializing Engine...
                                        </>
                                    ) : (
                                        <span className="flex items-center gap-3">
                                            Create and Track
                                            <ArrowRight size={20} strokeWidth={3} />
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
                            className="bg-card border border-border shadow-2xl rounded-[2.5rem] p-10 relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-blue-500 to-primary/50" />
                            
                            <div className="mb-10">
                                <div className="flex items-center gap-4 text-emerald-500 mb-6">
                                    <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                        <CheckCircle size={32} />
                                    </div>
                                    <h2 className="text-3xl font-black text-foreground tracking-tighter">Setup Complete!</h2>
                                </div>
                                <p className="text-muted-foreground font-bold text-lg leading-relaxed">
                                    Your website <span className="text-primary font-black">{name}</span> is ready. Add the tracking script to your site's <span className="text-foreground font-black italic">{'<head>'}</span> section.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">Tracking Code</span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={copyToClipboard}
                                        className="h-8 px-4 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-black uppercase tracking-widest text-[9px] transition-all"
                                    >
                                        {copied ? 'Copied Snippet!' : 'Copy Snippet'}
                                    </Button>
                                </div>
                                <div className="relative group">
                                    <pre className="p-8 rounded-[1.5rem] bg-accent/5 border border-border/40 text-[11px] font-mono leading-relaxed overflow-x-auto text-foreground shadow-inner custom-scrollbar">
                                        <code>{trackingCode}</code>
                                    </pre>
                                </div>
                            </div>

                            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Button 
                                    variant="brand" 
                                    className="h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20"
                                    onClick={() => router.push(`/websites/${newlyCreatedSiteId}`)}
                                >
                                    Dashboard
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="h-14 rounded-2xl font-black uppercase tracking-widest text-xs border-border/40 bg-transparent hover:bg-accent/5"
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

        <div className="mt-12 self-center lg:self-start">
             <Link href="/">
                <Button variant="ghost" size="sm" className="text-muted-foreground font-black uppercase tracking-widest text-[10px] hover:bg-transparent hover:text-primary transition-colors px-0 group">
                    <ArrowLeft size={16} className="mr-3 group-hover:-translate-x-1 transition-transform" />
                    Explorer Mode
                </Button>
            </Link>
        </div>
      </div>
    </div>
  );
}