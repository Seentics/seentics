'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Lock, 
  Eye, 
  Download, 
  Trash2, 
  CheckCircle, 
  Globe, 
  Users,
  Database,
  Settings
} from 'lucide-react';

export default function ComplianceSection() {
  const complianceFeatures = [
    {
      icon: Shield,
      title: 'GDPR Compliant',
      description: 'Full compliance with European data protection regulations',
      features: ['Right to Access', 'Right to Deletion', 'Data Portability', 'Consent Management']
    },
    {
      icon: Lock,
      title: 'CCPA Ready',
      description: 'California Consumer Privacy Act compliance built-in',
      features: ['Right to Know', 'Right to Delete', 'Opt-out Controls', 'Non-discrimination']
    },
    {
      icon: Eye,
      title: 'Transparent Data Practices',
      description: 'Clear visibility into how data is collected and used',
      features: ['Privacy Policy', 'Data Processing', 'Third-party Sharing', 'Audit Logs']
    }
  ];

  const privacyControls = [
    {
      icon: Download,
      title: 'Data Export',
      description: 'Users can download all their personal data in structured formats',
      benefit: 'Builds trust and meets legal requirements'
    },
    {
      icon: Trash2,
      title: 'Right to be Forgotten',
      description: 'Complete data deletion within 30 days as required by law',
      benefit: 'Respects user privacy choices'
    },
    {
      icon: Settings,
      title: 'Granular Consent',
      description: 'Cookie and tracking preferences with easy opt-out options',
      benefit: 'User-friendly privacy controls'
    },
    {
      icon: Database,
      title: 'Data Retention',
      description: 'Automated cleanup policies with configurable retention periods',
      benefit: 'Minimizes data storage and compliance risk'
    }
  ];

  return (
    <section id="compliance" className="py-16 md:py-20 lg:py-24 bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded">
              <Shield className="h-8 w-8 text-green-600" />
            </div>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 px-3 py-1">
              Enterprise Ready
            </Badge>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-slate-100 mb-6">
            Built for Privacy & Compliance
          </h2>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
            Seentics is designed with privacy-first principles, ensuring your business meets global data protection standards 
            while building customer trust through transparent data practices.
          </p>
        </div>

        {/* Compliance Standards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {complianceFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
                <CardHeader className="text-center">
                  <div className="mx-auto p-3 bg-green-100 dark:bg-green-900/20 rounded mb-4">
                    <Icon className="h-8 w-8 text-green-600" />
                  </div>
                  <CardTitle className="text-xl text-slate-900 dark:text-slate-100">
                    {feature.title}
                  </CardTitle>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    {feature.description}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {feature.features.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Privacy Controls */}
        <div className="mb-16">
          <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 text-center mb-12">
            Comprehensive Privacy Controls
          </h3>
          <div className="grid md:grid-cols-2 gap-8">
            {privacyControls.map((control, index) => {
              const Icon = control.icon;
              return (
                <Card key={index} className="border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded">
                        <Icon className="h-6 w-6 text-slate-600" />
                      </div>
                      <CardTitle className="text-lg text-slate-900 dark:text-slate-100">
                        {control.title}
                      </CardTitle>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      {control.description}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-700 rounded p-3">
                      <p className="text-sm text-slate-800 dark:text-slate-200">
                        <strong>Benefit:</strong> {control.benefit}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="bg-white dark:bg-slate-800 rounded p-8 md:p-12 border border-slate-200 dark:border-slate-700">
          <div className="text-center mb-8">
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Why Privacy Matters for Your Business
            </h3>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              In today's digital landscape, privacy isn't just a legal requirement—it's a competitive advantage that builds customer trust and loyalty.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="mx-auto p-3 bg-green-100 dark:bg-green-900/20 rounded mb-4 w-16 h-16 flex items-center justify-center">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Customer Trust
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Transparent data practices build lasting relationships with your customers
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto p-3 bg-slate-100 dark:bg-slate-800 rounded mb-4 w-16 h-16 flex items-center justify-center">
                <Globe className="h-8 w-8 text-slate-600" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Global Compliance
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Meet regulations in EU, California, and other privacy-conscious markets
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto p-3 bg-purple-100 dark:bg-purple-900/20 rounded mb-4 w-16 h-16 flex items-center justify-center">
                <Shield className="h-8 w-8 text-purple-600" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Risk Mitigation
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Reduce legal risks and avoid costly compliance violations
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <div className="bg-gradient-to-r from-green-50 to-slate-50 dark:from-green-950/20 dark:to-slate-950/20 border border-green-200 dark:border-green-800 rounded p-8">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Ready to Build Trust with Privacy-First Analytics?
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-2xl mx-auto">
              Join thousands of businesses that trust Seentics to handle their data responsibly while gaining powerful insights into customer behavior.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="#pricing" 
                className="inline-flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded transition-colors duration-200"
              >
                Start Free Trial
              </a>
              <a 
                href="/privacy" 
                className="inline-flex items-center justify-center px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold rounded transition-colors duration-200"
              >
                View Privacy Policy
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
