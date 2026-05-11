'use client';

import { useAuth } from '@/stores/useAuthStore';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';
import { openCheckout } from '@/lib/checkout';
import { toast } from 'sonner';
import { useState } from 'react';
import { Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function LifetimeDeal() {
  if (!isEnterprise) return null;

  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      window.location.href = '/signup';
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/user/billing/checkout', {
        plan: 'lifetime',
        billing: 'monthly',
      });

      if (response.data.success && response.data.data.checkoutUrl) {
        openCheckout(response.data.data.checkoutUrl);
      }
    } catch {
      toast.error('Failed to initialize checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    'Unlimited Websites',
    '300,000 Events/month',
    '3,000 Session Recordings',
    '1,000 AI Analyses / month',
    'Unlimited Heatmaps',
    'Unlimited Funnels & Automations',
    '3 Year Data Retention',
    'API, SDK & UI Blocks',
    '9 Team Members',
    'Email Support',
  ];

  return (
    <section id="lifetime-deal" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left Column - Features & Description */}
            <div>
              <div className="mb-10">
                <div className="inline-block bg-blue-600/10 border border-blue-600/20 rounded-full px-3 py-1.5 mb-6">
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-600">Limited Time</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-3 leading-tight">Lifetime Deal</h2>
                <p className="text-muted-foreground text-base">All the features you need, one-time payment. No subscriptions, no recurring charges.</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-5 uppercase tracking-wide">What's Included</h3>
                <ul className="space-y-3.5">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Column - Pricing */}
            <div className="flex justify-center md:justify-end">
              <div className="w-full max-w-sm">
                <div className={cn(
                  'relative rounded-2xl border bg-gradient-to-br from-blue-600/5 to-transparent p-8 transition-all duration-300',
                  'border-blue-500/30 shadow-lg shadow-blue-500/5'
                )}>
                  {/* Badge */}
                  <div className="absolute -top-4 right-6">
                    <span className="inline-block text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full text-white bg-blue-600">
                      Best Value
                    </span>
                  </div>

                  <div className="mb-8 pt-2">
                    <p className="text-xs text-muted-foreground font-medium mb-3">One-time payment</p>
                    <div className="mb-2">
                      <span className="text-6xl font-bold tracking-tight text-blue-600">$199</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Forever access. No recurring charges.</p>
                  </div>

                  <Button
                    onClick={handleSubscribe}
                    disabled={loading}
                    size="lg"
                    className="w-full mb-6 text-sm font-semibold"
                  >
                    {loading ? 'Processing...' : 'Get Lifetime Deal'}
                  </Button>

                  <div className="space-y-3 border-t border-border/50 pt-6">
                    <div className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-blue-600 shrink-0" />
                      <span className="text-xs text-muted-foreground">Cancel anytime</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-blue-600 shrink-0" />
                      <span className="text-xs text-muted-foreground">30-day money back</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
