'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield, Lock, Eye, Database, Globe, Mail, Phone } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl font-bold text-foreground">Privacy Policy</h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We are committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information.
            </p>
          </div>

          {/* Last Updated */}
          <Card className="mb-8 border-primary/20 dark:bg-gray-800/50 shadow-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-primary" />
                <span className="text-foreground font-medium">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Content */}
          <div className="space-y-8">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-foreground underline decoration-primary/30 decoration-4 underline-offset-4">1. Information We Collect</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <p>We collect several types of information to provide and improve our services:</p>
                
                <h4 className="font-semibold text-foreground mt-4 italic">Personal Information:</h4>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Name and email address when you create an account</li>
                  <li>Profile information and preferences</li>
                  <li>Communication history with our support team</li>
                  <li>Payment and billing information</li>
                </ul>

                <h4 className="font-semibold text-foreground mt-4 italic">Website Analytics Data:</h4>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Visitor behavior and interactions</li>
                  <li>Page views and session duration</li>
                  <li>Traffic sources and referral information</li>
                  <li>Device and browser information</li>
                  <li>Geographic location data (country/city level)</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-foreground underline decoration-primary/30 decoration-4 underline-offset-4">2. How We Use Your Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <p>We use the collected information for the following purposes:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide, maintain, and improve our services</li>
                  <li>Process transactions and manage subscriptions</li>
                  <li>Send important service updates and notifications</li>
                  <li>Respond to customer support requests</li>
                  <li>Analyze usage patterns to enhance user experience</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-foreground underline decoration-primary/30 decoration-4 underline-offset-4">3. Data Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <p>We implement appropriate technical and organizational measures to protect your information:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Regular security assessments and updates</li>
                  <li>Access controls and authentication measures</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-foreground underline decoration-primary/30 decoration-4 underline-offset-4">4. Contact Us</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <p>If you have any questions about this Privacy Policy, please contact us:</p>
                <div className="bg-muted/30 p-6 rounded space-y-4 border border-border/50">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">Email: privacy@seentics.com</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">Website: www.seentics.com</span>
                  </div>
                </div>
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
