'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, DollarSign, Users, Clock, Zap, Target, BarChart3, Star, ArrowRight, CheckCircle } from 'lucide-react';

const results = [
  {
    icon: TrendingUp,
    metric: "23%",
    label: "Average conversion increase",
    description: "Businesses see an average 23% boost in conversion rates within 30 days",
    color: "from-green-500 to-emerald-600",
    bgColor: "from-green-50 to-emerald-50",
    darkBgColor: "from-green-950/20 to-emerald-950/10"
  },
  {
    icon: DollarSign,
    metric: "15-25%",
    label: "Growth through insights",
    description: "Identify and fix drop-off points with real-time visitor behavior analytics",
    color: "from-slate-500 to-slate-600",
    bgColor: "from-slate-50 to-slate-100",
    darkBgColor: "from-slate-950/20 to-slate-900/10"
  },
  {
    icon: Users,
    metric: "8-12%",
    label: "User retention",
    description: "Improve retention by understanding user flows and engagement patterns",
    color: "from-purple-500 to-violet-600",
    bgColor: "from-purple-50 to-violet-50",
    darkBgColor: "from-purple-950/20 to-violet-950/10"
  },
  {
    icon: Clock,
    metric: "2 min",
    label: "Setup time",
    description: "Install our lightweight tracker and see live data in under 2 minutes",
    color: "from-orange-500 to-red-600",
    bgColor: "from-orange-50 to-red-50",
    darkBgColor: "from-orange-950/20 to-red-950/10"
  },
  {
    icon: Target,
    metric: "500+",
    label: "Businesses trust us",
    description: "Join hundreds of companies already using Seentics",
    color: "from-slate-500 to-slate-600",
    bgColor: "from-slate-50 to-slate-100",
    darkBgColor: "from-slate-950/20 to-slate-900/10"
  },
  {
    icon: BarChart3,
    metric: "Real-time",
    label: "Analytics & insights",
    description: "See the impact of every change in real-time with live reporting",
    color: "from-pink-500 to-rose-600",
    bgColor: "from-pink-50 to-rose-50",
    darkBgColor: "from-pink-950/20 to-rose-950/10"
  }
];

const testimonials = [
  {
    quote: "Seentics transformed our conversion strategy. We saw a 40% increase in revenue within the first quarter.",
    author: "Alex Chen",
    role: "Head of Growth",
    company: "TechFlow",
    avatar: "AC",
    rating: 5,
    highlight: "40% revenue increase"
  },
  {
    quote: "The behavioral insights helped us optimize our landing page in days. We saved thousands in lost traffic.",
    author: "Sarah Rodriguez",
    role: "E-commerce Director",
    company: "ShopSmart",
    avatar: "SR",
    rating: 5,
    highlight: "Simplified tracking"
  },
  {
    quote: "Finally, an analytics tool that is actually easy to use. Game-changing for conversion optimization.",
    author: "Michael Thompson",
    role: "Marketing Lead",
    company: "StartupXYZ",
    avatar: "MT",
    rating: 5,
    highlight: "Game-changing tool"
  }
];

export default function ResultsShowcase() {
  return (
    <section className="py-16 sm:py-20 md:py-24 lg:py-32 bg-gradient-to-br from-slate-50 via-slate-100/20 to-slate-200/20 dark:from-slate-950 dark:via-slate-900/20 dark:to-slate-800/10 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-slate-200/20 to-slate-300/20 dark:from-slate-800/10 dark:to-slate-700/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-green-200/20 to-emerald-200/20 dark:from-green-800/10 dark:to-emerald-800/10 rounded-full blur-3xl"></div>
      </div>
      
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* Enhanced Header */}
        <div className="text-center mb-12 sm:mb-16 md:mb-20 lg:mb-24">
          <div className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-4 sm:mb-6">
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Proven Results</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 sm:mb-6 text-slate-900 dark:text-white">
            Results That{' '}
            <span className="text-slate-600 dark:text-slate-400">
              Speak for Themselves
            </span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-slate-600 dark:text-slate-300 max-w-4xl mx-auto px-2 sm:px-4 leading-relaxed">
            See the real impact Seentics has on businesses just like yours. 
            <span className="font-semibold text-slate-700 dark:text-slate-200"> Join 500+ companies</span> already seeing results.
          </p>
        </div>
        
        {/* Enhanced Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-10 mb-16 sm:mb-20 md:mb-24 lg:mb-28 max-w-7xl mx-auto">
          {results.map((result, index) => (
            <Card key={index} className="group relative overflow-hidden bg-white dark:bg-slate-800 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 border border-slate-200 dark:border-slate-700">
              {/* Gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${result.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
              
              {/* Top accent line */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${result.color} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`}></div>
              
              <CardContent className="p-6 sm:p-8 md:p-10 text-center relative z-10">
                <div className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-br ${result.bgColor} dark:${result.darkBgColor} rounded flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <result.icon className={`h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-transparent bg-clip-text bg-gradient-to-r ${result.color}`} />
                </div>
                <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3 group-hover:scale-105 transition-transform duration-300">
                  {result.metric}
                </div>
                <div className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-700 dark:text-slate-300 mb-3 sm:mb-4">
                  {result.label}
                </div>
                <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                  {result.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Enhanced Testimonials */}
        <div className="text-center mb-12 sm:mb-16 md:mb-20">
          <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-8 sm:mb-10 md:mb-12 text-slate-900 dark:text-white">
            What Our Customers{' '}
            <span className="text-slate-600 dark:text-slate-400">
              Actually Say
            </span>
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 md:gap-10 max-w-6xl mx-auto mb-16 sm:mb-20 md:mb-24">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="group relative overflow-hidden bg-white dark:bg-slate-800 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 border border-slate-200 dark:border-slate-700">
              {/* Highlight badge */}
              <div className="absolute top-3 sm:top-4 right-3 sm:right-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 sm:px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                {testimonial.highlight}
              </div>
              
              <CardContent className="p-6 sm:p-8 md:p-10">
                {/* Enhanced rating */}
                <div className="flex items-center gap-1 mb-4 sm:mb-6">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                
                <blockquote className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 mb-6 sm:mb-8 leading-relaxed italic font-medium">
                  "{testimonial.quote}"
                </blockquote>
                
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-slate-900 dark:bg-white rounded flex items-center justify-center text-white dark:text-slate-900 font-bold text-sm sm:text-lg md:text-xl shadow-lg">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-sm sm:text-base md:text-lg">
                      {testimonial.author}
                    </div>
                    <div className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400">
                      {testimonial.role} at {testimonial.company}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Enhanced CTA Section */}
        <div className="text-center">
          <div className="relative overflow-hidden bg-slate-900 dark:bg-slate-800 rounded p-8 sm:p-10 md:p-12 max-w-5xl mx-auto text-white shadow-2xl">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-24 sm:w-32 h-24 sm:h-32 border-2 border-white rounded-full"></div>
              <div className="absolute bottom-0 right-0 w-20 sm:w-24 h-20 sm:h-24 border-2 border-white rounded-full"></div>
              <div className="absolute top-1/2 left-1/4 w-12 sm:w-16 h-12 sm:h-16 border border-white rounded-full"></div>
            </div>
            
            <div className="relative z-10">
              <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
                Ready to See These{' '}
                <span className="text-yellow-200">Results?</span>
              </h3>
              <p className="text-lg sm:text-xl md:text-2xl mb-6 sm:mb-8 opacity-95 leading-relaxed">
                Start your free trial today and see the difference in{' '}
                <span className="font-semibold">30 days</span>
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
                <button className="group px-8 sm:px-10 py-4 sm:py-5 bg-white text-slate-900 font-bold rounded hover:bg-slate-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 flex items-center gap-3 w-full sm:w-auto">
                  <span>Start Free Trial</span>
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform duration-300" />
                </button>
                <button className="px-8 sm:px-10 py-4 sm:py-5 border-2 sm:border-3 border-white text-white font-bold rounded hover:bg-white hover:text-slate-900 transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 w-full sm:w-auto">
                  Schedule Demo
                </button>
              </div>
              
              {/* Trust indicators */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-white/20">
                <div className="flex items-center gap-2 text-xs sm:text-sm opacity-90">
                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm opacity-90">
                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm opacity-90">
                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
