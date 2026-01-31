'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Mail, Calendar, Loader2, Send } from 'lucide-react';
import Script from 'next/script';

export default function SupportPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, websiteId })
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
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1440px] mx-auto">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Support & Help</h1>
        <p className="text-muted-foreground font-medium">Have questions? We're here to help you get the most out of Seentics.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Contact Form */}
        <div className="space-y-6">
          <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center border border-primary/20">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Contact Us</h2>
                <p className="text-sm text-muted-foreground">Send us a message directly.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input 
                  id="name" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required 
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required 
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea 
                  id="message" 
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  required 
                  placeholder="How can we help you?"
                  className="min-h-[150px]"
                />
              </div>

              <Button type="submit" className="w-full font-bold" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send Message
              </Button>
            </form>
          </div>
        </div>

        {/* Calendly Widget */}
        <div className="space-y-6">
          <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm h-full min-h-[750px] relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <Calendar className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Book a Call</h2>
                <p className="text-sm text-muted-foreground">Schedule a 30-min session with us.</p>
              </div>
            </div>

            {/* Calendly Widget Container */}
            <div 
              className="calendly-inline-widget w-full h-[700px] border rounded bg-background" 
              data-url="https://calendly.com/shohagmiah2100/30min" 
              style={{ minWidth: '320px', height: '700px' }} 
            />
            <Script 
              type="text/javascript" 
              src="https://assets.calendly.com/assets/external/widget.js" 
              strategy="lazyOnload" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
