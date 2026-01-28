'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, RefreshCcw, CreditCard, Clock, CheckCircle2, Mail } from 'lucide-react';

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Back Button */}
      <div className="absolute top-6 left-6 z-20">
        <Link href="/">
          <Button variant="outline" size="sm" className="flex items-center gap-2 hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded">
                <RefreshCcw className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl font-bold text-foreground">Refund Policy</h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We want you to be happy with Seentics. If you're not satisfied, we're here to help.
            </p>
          </div>

          {/* Refund Content */}
          <div className="space-y-8">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <CardTitle className="text-2xl font-bold text-foreground underline decoration-primary/30 decoration-4 underline-offset-4">14-Day Money Back Guarantee</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  We offer a full refund within the first 14 days of your initial subscription. If you find that Seentics isn't the right fit for your needs during this period, we will refund your payment in full, no questions asked.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <CardTitle className="text-2xl font-bold text-foreground underline decoration-primary/30 decoration-4 underline-offset-4">Subscription Cancellations</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  You can cancel your subscription at any time through your account settings. Upon cancellation, your account will remain active until the end of your current billing period. We do not provide prorated refunds for partial months of service.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-2xl font-bold text-foreground underline decoration-primary/30 decoration-4 underline-offset-4">Exceptions</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Refunds are typically not granted for:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Subscriptions beyond the 14-day initial period</li>
                  <li>Monthly renewals after the first month</li>
                  <li>Accounts that have violated our Terms of Service</li>
                  <li>Overage charges for exceeding plan limits</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="h-5 w-5 text-primary" />
                  <CardTitle className="text-2xl font-bold text-foreground underline decoration-primary/30 decoration-4 underline-offset-4">How to Request a Refund</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  To request a refund, please email our support team at <span className="text-primary font-semibold">billing@seentics.com</span> with your account email and the reason for your request. We process most refunds within 3-5 business days.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Footer Navigation */}
          <div className="text-center mt-16 flex justify-center gap-4">
            <Link href="/terms">
              <Button variant="outline" className="hover:bg-accent transition-colors">
                Terms of Service
              </Button>
            </Link>
            <Link href="/privacy">
              <Button variant="outline" className="hover:bg-accent transition-colors">
                Privacy Notice
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
