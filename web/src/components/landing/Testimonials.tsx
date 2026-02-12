import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react';

const testimonials = [
  {
    name: "Alex Chen",
    role: "Head of Growth",
    company: "TechFlow",
    content: "Seentics analytics transformed our conversion strategy. We saw a 40% increase in revenue within the first quarter by understanding exactly where users were dropping off.",
    rating: 5,
    avatar: "AC"
  },
  {
    name: "Sarah Rodriguez",
    role: "E-commerce Director",
    company: "ShopSmart",
    content: "The behavioral insights and privacy-first approach alone paid for itself in the first month. We optimized our customer engagement based on real data, recovering $75K in lost sales.",
    rating: 5,
    avatar: "SR"
  },
  {
    name: "Michael Thompson",
    role: "Marketing Lead",
    company: "StartupXYZ",
    content: "Finally, an analytics tool that respects user privacy while still giving us the data we need. The real-time insights have revolutionized our approach to conversion optimization.",
    rating: 5,
    avatar: "MT"
  }
];

export default function Testimonials() {
  return (
    <section className="py-12 md:py-24 bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 md:mb-20">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 text-slate-900 dark:text-white">
            Trusted by Growth Teams Worldwide
          </h2>
          <p className="text-base md:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto px-4">
            See how leading companies are using Seentics to drive results
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-slate-800">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center gap-1 mb-4 md:mb-6">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 md:h-5 md:w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-sm md:text-lg text-slate-600 dark:text-slate-300 mb-4 md:mb-6 leading-relaxed">
                  "{testimonial.content}"
                </blockquote>
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-slate-900 font-semibold text-sm md:text-base">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm md:text-base">{testimonial.name}</div>
                    <div className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
                      {testimonial.role} at {testimonial.company}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
