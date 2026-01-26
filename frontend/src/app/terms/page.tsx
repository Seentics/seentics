'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText, Calendar, Shield, CheckCircle2 } from 'lucide-react';

export default function TermsOfServicePage() {
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
              <div className="p-3 bg-primary/10 rounded-xl">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl font-bold text-foreground">Terms of Service</h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Please read these terms carefully before using Seentics. By using our service, you agree to be bound by these terms.
            </p>
          </div>

          {/* Last Updated */}
          <Card className="mb-8 border-primary/20 bg-primary/5 shadow-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-foreground font-medium">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </CardContent>
          </Card>

          {/* Terms Content */}
          <div className="space-y-8">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-foreground underline decoration-primary/30 decoration-4 underline-offset-4">1. Acceptance of Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  By accessing and using Seentics ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. 
                  If you do not agree to abide by the above, please do not use this service.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-foreground underline decoration-primary/30 decoration-4 underline-offset-4">2. Description of Service</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Seentics provides website analytics, workflow automation, and AI-powered insights to help businesses optimize their online presence.
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 italic">
                  <li>Real-time website analytics and visitor tracking</li>
                  <li>Workflow automation and funnel creation tools</li>
                  <li>AI-powered insights and recommendations</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-foreground underline decoration-primary/30 decoration-4 underline-offset-4">3. User Accounts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  To access certain features, you must register for an account. You are responsible for safeguarding your credentials and for all activities that occur under your account.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-foreground underline decoration-primary/30 decoration-4 underline-offset-4">4. Subscription and Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Some features may require a paid subscription. All fees are non-refundable except as required by law or as specified in our Refund Policy.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Footer Navigation */}
          <div className="text-center mt-16 flex justify-center gap-4">
            <Link href="/privacy">
              <Button variant="outline" className="hover:bg-accent transition-colors">
                Privacy Notice
              </Button>
            </Link>
            <Link href="/refund-policy">
              <Button variant="outline" className="hover:bg-accent transition-colors">
                Refund Policy
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
