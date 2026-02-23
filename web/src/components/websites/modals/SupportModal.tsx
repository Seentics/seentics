'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    message: ''
  });

  if (!isEnterprise) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await api.post('/user/support/contact', {
        subject: `[Support Modal] Message from ${formData.name}`,
        message: formData.message,
        email: formData.email
      });

      setIsSuccess(true);
      setFormData({ name: '', email: '', message: '' });
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send message.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-semibold">Contact Support</DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-2">
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center text-center py-10 space-y-4">
              <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium">Thank you! Your message has been sent.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="m-name" className="text-xs font-medium text-slate-500">Name</Label>
                <Input
                  id="m-name"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="m-email" className="text-xs font-medium text-slate-500">Email</Label>
                <Input
                  id="m-email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="m-message" className="text-xs font-medium text-slate-500">Message</Label>
                <Textarea
                  id="m-message"
                  placeholder="How can we help you today?"
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  className="resize-none"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/5 p-3 rounded-lg border border-red-500/10">
                  <AlertCircle className="w-4 h-4" />
                  <p>{error}</p>
                </div>
              )}

              <Button type="submit" disabled={isSubmitting} className="w-full h-11 font-medium mt-2">
                {isSubmitting ? "Sending..." : "Send Message"}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
