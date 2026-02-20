'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, Calendar, Loader2, Send, ExternalLink } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import Script from 'next/script';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { isEnterprise } from '@/lib/features';

export default function SupportPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const router = useRouter();

  useEffect(() => {
    if (!isEnterprise) {
      router.replace(`/websites/${websiteId}`);
    }
  }, [router, websiteId]);

  if (!isEnterprise) return null;

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, websiteId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      toast.success('Message sent! We will get back to you shortly.');
      setFormData({ name: '', email: '', message: '' });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
      <DashboardPageHeader
        title="Support"
        description="Get help from the team or schedule a call."
      />

      {/* Discord Banner */}
      <Card className="border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
              <FaDiscord className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Join our Discord community</h3>
              <p className="text-xs text-indigo-600/70 dark:text-indigo-400/60">Get help from the team and community in real-time.</p>
            </div>
          </div>
          <a href="https://discord.gg/TYdPvDRA" target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="gap-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white">
              <ExternalLink className="h-3.5 w-3.5" />
              Join Discord
            </Button>
          </a>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Contact Form */}
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Contact Us</h2>
                <p className="text-xs text-muted-foreground">Send us a message directly.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  placeholder="you@company.com"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message" className="text-xs font-medium">Message</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  required
                  placeholder="How can we help you?"
                  className="min-h-[120px] text-sm"
                />
              </div>

              <Button type="submit" size="sm" className="w-full gap-1.5 text-xs font-medium" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send Message
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Calendly Widget */}
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="p-5 h-full min-h-[600px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Book a Call</h2>
                <p className="text-xs text-muted-foreground">Schedule a 30-min session with us.</p>
              </div>
            </div>

            <div
              className="calendly-inline-widget w-full h-[540px] border border-border/40 rounded-md bg-background"
              data-url="https://calendly.com/shohagmiah2100/30min"
              style={{ minWidth: '280px', height: '540px' }}
            />
            <Script
              type="text/javascript"
              src="https://assets.calendly.com/assets/external/widget.js"
              strategy="lazyOnload"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
