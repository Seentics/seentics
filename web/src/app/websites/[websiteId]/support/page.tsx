'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Mail,
  Calendar,
  Loader2,
  Send,
  ExternalLink,
} from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import Script from 'next/script';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { isDemo } from '@/lib/demo';

type TabId = 'contact' | 'call';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'contact', label: 'Contact', icon: Mail },
  { id: 'call', label: 'Book a Call', icon: Calendar },
];

export default function SupportPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabId>('contact');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  useEffect(() => {
    if (!isEnterprise) router.replace(`/websites/${websiteId}`);
  }, [router, websiteId]);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo(websiteId)) {
      toast.info('Demo Mode', { description: 'Messages are not sent in demo mode. Sign up to get started!' });
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/user/support/contact', {
        ...formData,
        websiteId,
      });
      toast.success('Message sent! We\'ll get back to you shortly.');
      setFormData({ name: '', email: '', message: '' });
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to send message';
      toast.error(msg);
    } finally { setIsLoading(false); }
  };

  if (!isEnterprise) return null;

  return (
    <div className="p-6 md:p-8 max-w-[1300px] mx-auto animate-in fade-in duration-500">
      {/* Page header */}
      <div className="mb-6">
        <DashboardPageHeader
          title="Support"
          description="Get help from our team, send a message, or book a call."
        />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-border/60 mb-8">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-sm',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contact tab */}
      {activeTab === 'contact' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Quick channels */}
          <div className="grid sm:grid-cols-2 gap-3">
            <a
              href="https://discord.gg/eHNHR82add"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                <FaDiscord className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Discord Community</p>
                <p className="text-xs text-indigo-500/80 dark:text-indigo-400/60 mt-0.5">Get help in real-time</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-indigo-400 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
            </a>

            <a
              href="mailto:seentics@gmail.com"
              className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Email Support</p>
                <p className="text-xs text-muted-foreground mt-0.5">seentics@gmail.com</p>
              </div>
            </a>
          </div>

          {/* Contact form */}
          <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="px-5 py-4 border-b border-border/50 bg-muted/20">
              <h2 className="text-sm font-semibold">Send a Message</h2>
              <p className="text-xs text-muted-foreground mt-0.5">We'll respond to your email within one business day.</p>
            </div>
            <form onSubmit={handleContactSubmit} className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    required
                    placeholder="Your name"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                    required
                    placeholder="you@company.com"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message" className="text-xs font-medium">Message</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData(p => ({ ...p, message: e.target.value }))}
                  required
                  placeholder="How can we help you?"
                  className="min-h-[120px] text-sm resize-none"
                />
              </div>
              <Button type="submit" size="sm" className="gap-1.5 text-xs font-medium h-8" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send Message
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Book a Call tab */}
      {activeTab === 'call' && (
        <div className="animate-in fade-in duration-200">
          <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="px-5 py-4 border-b border-border/50 bg-muted/20">
              <h2 className="text-sm font-semibold">Book a 30-min Call</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Pick a time that works for you and we'll jump on a call.</p>
            </div>
            <div className="p-0">
              <div
                className="calendly-inline-widget w-full"
                data-url="https://calendly.com/shohagmiah2100/30min"
                style={{ minWidth: '280px', height: '660px' }}
              />
              <Script
                type="text/javascript"
                src="https://assets.calendly.com/assets/external/widget.js"
                strategy="lazyOnload"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
