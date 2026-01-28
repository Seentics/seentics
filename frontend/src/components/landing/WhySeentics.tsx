'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Target, Zap, Shield, Brain, Workflow, Clock, Users, Crown } from 'lucide-react';

const platforms = [
  {
    name: 'Google Analytics',
    description: 'Complex but comprehensive analytics',
    logo: '🔍',
    rating: 4.2,
    pricing: 'Free + Premium',
    strengths: ['Comprehensive data', 'Free tier', 'Integrations'],
    weaknesses: ['Complex setup', 'Privacy concerns', 'No automation']
  },
  {
    name: 'Plausible',
    description: 'Simple, privacy-focused analytics',
    logo: '📊', 
    rating: 4.5,
    pricing: 'Paid only',
    strengths: ['Privacy-first', 'Simple interface', 'GDPR compliant'],
    weaknesses: ['Basic features only', 'No automation', 'No AI insights']
  },
  {
    name: 'Fathom',
    description: 'Privacy analytics with more features',
    logo: '🎯',
    rating: 4.3,
    pricing: 'Paid only',
    strengths: ['Privacy compliant', 'Good reporting', 'Fast performance'],
    weaknesses: ['No automation', 'Limited AI', 'Basic integrations']
  },
  {
    name: 'Seentics',
    description: 'Analytics + Automation + AI',
    logo: '🚀',
    rating: 4.8,
    pricing: 'Free + Premium',
    strengths: ['Workflow automation', 'AI-powered', 'Privacy compliant', 'Easy setup'],
    weaknesses: ['Newer platform', 'Learning curve'],
    isRecommended: true
  }
];

const keyFeatures = [
  {
    feature: 'Basic Analytics',
    icon: Target,
    google: true,
    plausible: true, 
    fathom: true,
    seentics: true
  },
  {
    feature: 'Privacy Compliant',
    icon: Shield,
    google: false,
    plausible: true,
    fathom: true, 
    seentics: true
  },
  {
    feature: 'Workflow Automation',
    icon: Workflow,
    google: false,
    plausible: false,
    fathom: false,
    seentics: true
  },
  {
    feature: 'AI Optimization',
    icon: Brain,
    google: false,
    plausible: false,
    fathom: false,
    seentics: true
  },
  {
    feature: 'Multi-site Management',
    icon: Users,
    google: true,
    plausible: false,
    fathom: false,
    seentics: true
  },
  {
    feature: 'Easy Setup',
    icon: Clock,
    google: false,
    plausible: true,
    fathom: true,
    seentics: true
  },
  {
    feature: 'Free Tier Available',
    icon: Zap,
    google: true,
    plausible: false,
    fathom: false,
    seentics: true
  }
];

export default function ImprovedComparison() {
  return (
    <section className="py-20 bg-slate-100 dark:bg-slate-900">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-16">
            <Badge className="mb-6 px-4 py-2 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Target className="w-4 h-4 mr-2" />
              Platform Comparison
            </Badge>
            
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">
              Why Choose Seentics?
            </h2>
            
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
              While others just track visitors, Seentics automatically engages them to boost conversions
            </p>
          </div>

          {/* Platform Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {platforms.map((platform, index) => (
              <Card key={index} className={`relative ${platform.isRecommended ? 'ring-2 ring-slate-500 shadow-xl' : 'shadow-lg'} bg-white dark:bg-slate-800`}>
                {platform.isRecommended && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-slate-900 text-white px-3 py-1">
                      <Crown className="w-3 h-3 mr-1" />
                      Recommended
                    </Badge>
                  </div>
                )}
                
                <CardContent className="p-6">
                  <div className="text-center mb-4">
                    <div className="text-3xl mb-2">{platform.logo}</div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                      {platform.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      {platform.description}
                    </p>
                    
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {platform.pricing}
                    </p>
                  </div>

                  {/* Strengths */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">Strengths</h4>
                    <ul className="space-y-1">
                      {platform.strengths.slice(0, 3).map((strength, strengthIndex) => (
                        <li key={strengthIndex} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <Check className="w-3 h-3 text-green-600 flex-shrink-0" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Weaknesses */}
                  <div>
                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">Weaknesses</h4>
                    <ul className="space-y-1">
                      {platform.weaknesses.slice(0, 2).map((weakness, weaknessIndex) => (
                        <li key={weaknessIndex} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <X className="w-3 h-3 text-red-600 flex-shrink-0" />
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Feature Comparison Table */}
          <Card className="bg-white dark:bg-slate-800 shadow-xl">
            <CardContent className="p-0">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  Feature Comparison
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  See what makes Seentics different
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Feature
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Google Analytics
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Plausible
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Fathom
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/20">
                        Seentics
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {keyFeatures.map((feature, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-700'}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center">
                              <feature.icon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                            </div>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {feature.feature}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {feature.google ? (
                            <Check className="w-5 h-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-red-500 mx-auto" />
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {feature.plausible ? (
                            <Check className="w-5 h-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-red-500 mx-auto" />
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {feature.fathom ? (
                            <Check className="w-5 h-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-red-500 mx-auto" />
                          )}
                        </td>
                        <td className="px-4 py-4 text-center bg-slate-50 dark:bg-slate-950/20">
                          {feature.seentics ? (
                            <Check className="w-5 h-5 text-slate-600 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-red-500 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>


        </div>
      </div>
    </section>
  );
}