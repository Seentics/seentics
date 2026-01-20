'use client';

import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, CheckCircle } from 'lucide-react';

export default function ProblemStatement() {
  const features = [
    {
      icon: BarChart3,
      title: "Analytics",
      subtitle: "See What Really Happens",
      description: "Get clear insights into who visits your website, what they do, and why they leave. No confusing charts - just the data that helps you grow your business.",
      benefits: [
        "Track every visitor in real-time",
        "See which pages work best",
        "Understand where visitors come from",
        "Monitor conversions and sales automatically",
        "Get instant alerts when something changes",
        "Compare different time periods easily"
      ],
      technical: ["Real-time tracking", "Easy reports", "Smart alerts", "Growth insights"]
    },
  ];
  return (
    <section className="py-20 bg-white dark:bg-slate-950 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 w-32 h-32 bg-blue-200/20 dark:bg-blue-800/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-10 left-10 w-40 h-40 bg-purple-200/20 dark:bg-purple-800/10 rounded-full blur-2xl"></div>
        <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-green-100/10 dark:bg-green-900/5 rounded-full blur-3xl"></div>
      </div>

      <div className="px-4 relative z-10">
        <div className="max-w-7xl mx-auto">

          {/* Enhanced Header */}
          <div className="text-center mb-16 sm:mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-700 dark:text-blue-300 text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              Privacy-First Analytics
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-slate-900 dark:text-white px-4 sm:px-0">
              Powerful Analytics
              <span className="block text-blue-600 dark:text-blue-400 mt-1 sm:mt-2">
                Without Compromising Privacy
              </span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-4xl mx-auto px-4 sm:px-0">
              Understand your visitors with cookieless tracking that respects privacy and complies with GDPR
            </p>
          </div>

          {/* Enhanced Feature Cards */}
          <div className="grid grid-cols-1 max-w-2xl mx-auto gap-8 md:gap-12 mb-20">
            {features.map((feature, index) => (
              <Card key={index} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-500 border border-slate-200/50 dark:border-slate-700/50 h-full hover:-translate-y-2 relative overflow-hidden group">
                {/* Card Overlay */}
                <div className="absolute inset-0 bg-blue-50/30 dark:bg-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <CardContent className="p-6 sm:p-8 flex flex-col h-full relative z-10">

                  {/* Enhanced Icon */}
                  <div className="flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl mb-6 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
                    <feature.icon className="h-10 w-10 text-white" />
                  </div>

                  {/* Title */}
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                    {feature.title}
                  </h3>

                  {/* Subtitle */}
                  <p className="text-base sm:text-lg text-blue-600 dark:text-blue-400 font-semibold mb-4">
                    {feature.subtitle}
                  </p>

                  {/* Description */}
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                    {feature.description}
                  </p>

                  {/* Enhanced Benefits */}
                  <ul className="space-y-3 mb-6 flex-grow">
                    {feature.benefits.map((benefit, benefitIndex) => (
                      <li key={benefitIndex} className="flex items-start gap-3 group/item">
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:scale-110 transition-transform duration-200">
                          <CheckCircle className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed group-hover/item:text-slate-900 dark:group-hover/item:text-slate-200 transition-colors duration-200">
                          {benefit}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Enhanced Technical Stack */}
                  <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50 mt-auto">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      What You Get
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {feature.technical.map((tech, techIndex) => (
                        <span key={techIndex} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-full font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-200">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                </CardContent>
              </Card>
            ))}
          </div>

          {/* CTA Section */}
          {/* <div className="text-center bg-slate-900 dark:bg-slate-800 rounded-2xl p-12">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Boost Your Conversions?
            </h3>
            
            <p className="text-xl text-slate-100 mb-8 max-w-2xl mx-auto">
              Join 500+ businesses using Seentics to increase conversions by <span className="font-bold text-white">23% on average</span>
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="gap-3 px-8 py-4 bg-white text-slate-900 hover:bg-slate-100 font-semibold">
                Get Started Free
                <ArrowRight className="h-5 w-5" />
              </Button>
              
              <Button variant="ghost" size="lg" className="gap-3 px-8 py-4 text-white hover:bg-white/10 border border-white/20">
                View Demo
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="flex items-center justify-center gap-6 mt-6 text-sm text-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <span>14-day free trial</span>
              </div>
            </div>
          </div> */}
        </div>
      </div>
    </section>
  );
}