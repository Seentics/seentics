'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Lock, 
  CheckCircle, 
  Users, 
  Globe, 
  Award,
  Eye,
  Download,
  Trash2,
  Settings
} from 'lucide-react';

export default function TrustSection() {
  const trustMetrics = [
    {
      number: '99.9%',
      label: 'Uptime SLA',
      description: 'Enterprise-grade reliability'
    },
    {
      number: '256-bit',
      label: 'Encryption',
      description: 'Bank-level security'
    },
    {
      number: 'GDPR',
      label: 'Compliant',
      description: 'EU data protection'
    },
    {
      number: 'CCPA',
      label: 'Ready',
      description: 'California privacy law'
    }
  ];

  const complianceFeatures = [
    {
      icon: Eye,
      title: 'Transparent Data Collection',
      description: 'Clear visibility into what data we collect and how it\'s used',
      benefit: 'Builds customer trust'
    },
    {
      icon: Download,
      title: 'Data Portability',
      description: 'Users can export all their data in standard formats',
      benefit: 'Meets legal requirements'
    },
    {
      icon: Trash2,
      title: 'Right to Deletion',
      description: 'Complete data removal within 30 days as required by law',
      benefit: 'Respects user privacy'
    },
    {
      icon: Settings,
      title: 'Granular Controls',
      description: 'Users control exactly what data they share',
      benefit: 'Enhanced user experience'
    }
  ];

  const certifications = [
    {
      name: 'GDPR Compliance',
      description: 'Full compliance with European data protection regulations',
      icon: Shield,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20'
    },
    {
      name: 'CCPA Ready',
      description: 'California Consumer Privacy Act compliance built-in',
      icon: Lock,
      color: 'text-slate-600',
      bgColor: 'bg-slate-100 dark:bg-slate-800'
    },
    {
      name: 'SOC 2 Type II',
      description: 'Security and compliance audit certification',
      icon: Award,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20'
    },
    {
      name: 'ISO 27001',
      description: 'International information security standard',
      icon: Globe,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20'
    }
  ];

  return (
    <section className="py-16 md:py-20 lg:py-24 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className="mb-6 px-4 py-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            <Shield className="w-4 h-4 mr-2" />
            Trust & Compliance
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-slate-100 mb-6">
            Built for Enterprise Trust
          </h2>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
            Seentics is designed with enterprise-grade security and compliance, ensuring your business 
            meets global standards while protecting your customers' privacy.
          </p>
        </div>

        {/* Trust Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {trustMetrics.map((metric, index) => (
            <div key={index} className="text-center">
              <div className="bg-white dark:bg-slate-800 rounded p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  {metric.number}
                </div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {metric.label}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {metric.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Compliance Features */}
        <div className="mb-16">
          <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 text-center mb-12">
            Privacy-First Design
          </h3>
          <div className="grid md:grid-cols-2 gap-8">
            {complianceFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded">
                        <Icon className="h-6 w-6 text-green-600" />
                      </div>
                      <CardTitle className="text-lg text-slate-900 dark:text-slate-100">
                        {feature.title}
                      </CardTitle>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      {feature.description}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-3">
                      <p className="text-sm text-green-800 dark:text-green-200">
                        <strong>Benefit:</strong> {feature.benefit}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Certifications */}
        <div className="mb-16">
          <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 text-center mb-12">
            Industry Certifications & Compliance
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {certifications.map((cert, index) => {
              const Icon = cert.icon;
              return (
                <Card key={index} className="border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300 text-center">
                  <CardHeader className="text-center">
                    <div className={`mx-auto p-3 ${cert.bgColor} rounded mb-4 w-16 h-16 flex items-center justify-center`}>
                      <Icon className={`h-8 w-8 ${cert.color}`} />
                    </div>
                    <CardTitle className="text-lg text-slate-900 dark:text-slate-100">
                      {cert.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {cert.description}
                    </p>
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
              Why Leading Companies Choose Seentics
            </h3>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Our commitment to privacy, security, and compliance makes us the trusted choice for businesses 
              that value their customers' trust and need to meet strict regulatory requirements.
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
                Transparent data practices build lasting relationships and increase customer loyalty
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto p-3 bg-slate-100 dark:bg-slate-800 rounded mb-4 w-16 h-16 flex items-center justify-center">
                <Shield className="h-8 w-8 text-slate-600" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Risk Mitigation
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Reduce legal risks and avoid costly compliance violations with built-in safeguards
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto p-3 bg-purple-100 dark:bg-purple-900/20 rounded mb-4 w-16 h-16 flex items-center justify-center">
                <Award className="h-8 w-8 text-purple-600" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Competitive Advantage
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Stand out in your market with privacy-first practices that customers value
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <div className="bg-gradient-to-r from-green-50 to-slate-50 dark:from-green-950/20 dark:to-slate-950/20 border border-green-200 dark:border-green-800 rounded p-8">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Ready to Build Trust with Your Customers?
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-2xl mx-auto">
              Join thousands of businesses that trust Seentics to handle their data responsibly 
              while gaining powerful insights into customer behavior.
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
