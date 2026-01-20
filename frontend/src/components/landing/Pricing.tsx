'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Star, Zap, Crown } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for personal projects",
    icon: Star,
    popular: false,
    features: [
      "1 Website",
      "Unlimited Events",
      "Real-time Analytics",
      "Privacy Compliant",
      "Data Export",
      "Email Support"
    ],
    limitations: []
  },
  {
    name: "Standard",
    price: "$19",
    period: "per month",
    description: "Great for growing businesses",
    icon: Zap,
    popular: true,
    features: [
      "10 Websites",
      "Unlimited Events",
      "Advanced Analytics",
      "Priority Support",
      "Custom Domains",
      "API Access",
      "Data Import/Export",
      "Team Collaboration",
      "Custom Reports"
    ],
    limitations: []
  },
  {
    name: "Pro",
    price: "$49",
    period: "per month",
    description: "For scaling teams and agencies",
    icon: Crown,
    popular: false,
    features: [
      "Unlimited Websites",
      "Unlimited Events",
      "Enterprise Analytics",
      "24/7 Priority Support",
      "White-label Options",
      "Advanced API Access",
      "Custom Integrations",
      "Team Collaboration",
      "Custom Reports",
      "Dedicated Account Manager",
      "SLA Guarantee"
    ],
    limitations: []
  }
];

export default function Pricing() {
  const { isAuthenticated, user } = useAuth();

  return (
    <section id="pricing" className="py-20 bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/20 dark:bg-blue-800/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-purple-200/20 dark:bg-purple-800/10 rounded-full blur-2xl"></div>
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-green-100/10 dark:bg-green-900/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="px-4 relative z-10">
        
        {/* Enhanced Header */}
        <div className="text-center mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-700 dark:text-blue-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            Flexible Plans
          </div>
          
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-slate-900 dark:text-white px-4 sm:px-0">
            Simple, Transparent Pricing
          </h2>
          
          <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto px-4 sm:px-0">
            Start free forever. Upgrade when you need more websites. No hidden fees.
          </p>
        </div>
        
        {/* Enhanced Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 max-w-7xl mx-auto mb-20">
          {plans.map((plan, index) => (
            <div key={index} className="relative group">
              
              {/* Enhanced Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-semibold shadow-lg animate-pulse">
                    ⭐ Most Popular
                  </div>
                </div>
              )}
              
              {/* Enhanced Card */}
              <Card className={`bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-500 border border-slate-200/50 dark:border-slate-700/50 flex flex-col h-full hover:-translate-y-2 relative overflow-hidden ${
                plan.popular ? 'ring-2 ring-blue-500 scale-105' : ''
              }`}>
                {/* Card Overlay */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                  plan.popular ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'bg-slate-50/50 dark:bg-slate-700/20'
                }`}></div>
                <CardHeader className="text-center pb-6 relative z-10">
                  
                  {/* Enhanced Icon */}
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 ${
                    plan.popular 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-600 dark:bg-slate-700 text-white'
                  }`}>
                    <plan.icon className="h-10 w-10" />
                  </div>
                  
                  {/* Plan Name */}
                  <CardTitle className={`text-xl sm:text-2xl font-bold mb-2 transition-colors duration-300 ${
                    plan.popular 
                      ? 'text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400' 
                      : 'text-slate-900 dark:text-white group-hover:text-slate-600 dark:group-hover:text-slate-300'
                  }`}>
                    {plan.name}
                  </CardTitle>
                  
                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-4xl font-black text-slate-900 dark:text-white">
                      {plan.price}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 ml-2">
                      {plan.period}
                    </span>
                  </div>
                  
                  {/* Description */}
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-4">
                    {plan.description}
                  </p>
                </CardHeader>
                
                <CardContent className="flex flex-col flex-grow relative z-10">
                  {/* Enhanced Features List */}
                  <ul className="space-y-3 mb-6 flex-grow">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-3 group/item">
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:scale-110 transition-transform duration-200">
                          <CheckCircle className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed group-hover/item:text-slate-900 dark:group-hover/item:text-slate-200 transition-colors duration-200">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                  
                  {/* Enhanced CTA Button at bottom - always aligned */}
                  <div className="mt-auto">
                    {plan.name === 'Free' ? (
                      <Link href={isAuthenticated ? "/websites" : "/signup"}>
                        <Button 
                          className="w-full py-3 font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 shadow-lg hover:shadow-xl transition-all duration-300 group/btn"
                        >
                          Start Free
                        </Button>
                      </Link>
                    ) : (
                      <a 
                        href={`https://seentics.lemonsqueezy.com/buy/39b59b36-94d3-40a5-821c-e31b6836345c${user?.id ? `?checkout[custom_data][user_id]=${user.id}&checkout[email]=${encodeURIComponent(user.email || '')}` : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button 
                          className={`w-full py-3 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group/btn ${
                            plan.popular 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                              : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100'
                          }`}
                        >
                          Get {plan.name}
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
        
        {/* Enhanced Bottom Section */}
        <div className="text-center">
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-3xl p-8 sm:p-12 border border-slate-200/50 dark:border-slate-700/50 shadow-xl max-w-4xl mx-auto">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
              Questions About Pricing?
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
              All plans include unlimited events, real-time analytics, GDPR compliance, and data export.
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm text-slate-500 dark:text-slate-400 mb-8">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-full">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>No setup fees</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-full">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-full">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>30-day money back</span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/contact">
                <Button variant="outline" className="px-6 py-3 font-semibold border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Contact Sales
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="px-6 py-3 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                  Start Free Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
