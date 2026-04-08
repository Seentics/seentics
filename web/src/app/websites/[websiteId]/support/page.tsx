'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Mail,
  Calendar,
  Loader2,
  Send,
  ExternalLink,
  LifeBuoy,
  BookOpen,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import Script from 'next/script';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { isDemo } from '@/lib/demo';

const SUPPORT_EMAIL = 'seentics@gmail.com';

type TabId = 'contact' | 'call';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'contact', label: 'Contact', icon: Mail },
  { id: 'call', label: 'Book a Call', icon: Calendar },
];

export default function SupportPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  const [activeTab, setActiveTab] = useState<TabId>('contact');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo(websiteId)) {
      toast.info('Demo mode', {
        description: 'Messages are not sent in demo mode. Create a site to reach support.',
      });
      return;
    }

    if (isEnterprise) {
      setIsLoading(true);
      try {
        await api.post('/user/support/contact', {
          ...formData,
          websiteId,
        });
        toast.success('Message sent', {
          description: 'We will reply to your email as soon as we can.',
        });
        setFormData({ name: '', email: '', message: '' });
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } }; message?: string };
        const msg = err.response?.data?.error || err.message || 'Failed to send message';
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const subject = encodeURIComponent(`Seentics support — site ${websiteId.slice(0, 12)}…`);
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\n---\n${formData.message}`,
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    toast.success('Opening your email app', {
      description: `If nothing opens, email us at ${SUPPORT_EMAIL}`,
    });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1100px] mx-auto animate-in fade-in duration-500 space-y-8">
      <DashboardPageHeader
        title="Support"
        description="Ask a question, report an issue, or book time with the team."
        icon={LifeBuoy}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              How we help
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Use the contact form for product questions, billing (if applicable), and bug reports. Include
              your site URL and steps to reproduce when reporting issues—we respond faster with context.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3 text-xs">
            <div className="flex gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-3">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Response time</p>
                <p className="text-muted-foreground mt-0.5 leading-snug">
                  We aim to answer within one business day. Priority depends on your plan where applicable.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-3">
              <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Docs &amp; setup</p>
                <p className="text-muted-foreground mt-0.5 leading-snug">
                  <Link
                    href={`/websites/${websiteId}/docs`}
                    className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                  >
                    Open documentation
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </Link>{' '}
                  for tracking installation, privacy, and product guides.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href={`/websites/${websiteId}/developers`}
              className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Developer &amp; tracking setup
            </Link>
            <Link
              href={`/websites/${websiteId}/settings`}
              className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Workspace settings
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-sm',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'contact' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid sm:grid-cols-2 gap-3">
            <a
              href="https://discord.gg/eHNHR82add"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
                <FaDiscord className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Discord</p>
                <p className="text-xs text-indigo-500/80 dark:text-indigo-400/60 mt-0.5">
                  Community help and announcements
                </p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-indigo-400 group-hover:text-indigo-600 transition-colors shrink-0" />
            </a>

            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Email</p>
                <p className="text-xs text-muted-foreground mt-0.5">{SUPPORT_EMAIL}</p>
              </div>
            </a>
          </div>

          <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="px-5 py-4 border-b border-border/50 bg-muted/20">
              <h2 className="text-sm font-semibold">Send a message</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEnterprise
                  ? 'Delivered to our team from your account. We reply by email.'
                  : 'We will open your email client with your message pre-filled to our support address.'}
              </p>
            </div>
            <form onSubmit={handleContactSubmit} className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    required
                    placeholder="Your name"
                    className="h-9 text-sm"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    required
                    placeholder="you@company.com"
                    className="h-9 text-sm"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message" className="text-xs font-medium">
                  Message
                </Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                  required
                  placeholder="What can we help with? Include URLs or errors if relevant."
                  className="min-h-[140px] text-sm resize-y"
                />
              </div>
              <Button type="submit" size="sm" className="gap-1.5 h-9" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {isEnterprise ? 'Send message' : 'Send via email'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'call' && (
        <div className="animate-in fade-in duration-200">
          <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="px-5 py-4 border-b border-border/50 bg-muted/20">
              <h2 className="text-sm font-semibold">Book a 30-minute call</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pick a time below. Prefer email first? Use the Contact tab.
              </p>
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
