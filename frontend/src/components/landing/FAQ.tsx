import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { HelpCircle, MessageCircle, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const faqs = [
  {
    question: "Is Seentics really free forever?",
    answer: "Yes. Our Starter plan is 100% free and includes everything you need for a single website. We don't even ask for a credit card. We believe high-quality analytics should be accessible to everyone."
  },
  {
    question: "How does the tracking script affect performance?",
    answer: "Our script is ultra-lightweight (under 2KB). It's designed for performance and won't affect your Core Web Vitals or page load speed. It's significantly faster than Google Analytics and other legacy trackers."
  },
  {
    question: "Is Seentics GDPR and CCPA compliant?",
    answer: "Absolutely. We are cookieless by default and don't collect any personally identifiable information (PII). All data is processed and stored in compliance with the strictest privacy regulations."
  },
  {
    question: "Can I import my data from Google Analytics?",
    answer: "Yes! We offer a seamless import tool for both Universal Analytics and GA4 property data. You can bring your entire history into Seentics and continue your growth without losing context."
  },
  {
    question: "Do you offer custom enterprise solutions?",
    answer: "We do. For high-volume websites or specific infrastructure needs, we offer dedicated environments, volume discounts, and white-labeling. Contact our sales team for a custom quote."
  }
];

export default function FAQ() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <section id="faq" className="py-24 sm:py-32 relative overflow-hidden bg-background">
      <div className="container mx-auto px-6 relative z-10">
        
        {/* Header Section */}
        <div className="text-center mb-16 sm:mb-28 px-4">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-6"
          >
            Resolution
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-4xl sm:text-6xl  font-[1000] tracking-[-0.03em] mb-10 leading-[0.95]"
          >
            Common questions. <br />
            <span className="gradient-text">Instant answers.</span>
          </motion.h2>
          <p className="text-lg sm:text-xl text-muted-foreground/60 max-w-2xl mx-auto font-medium tracking-tight">
            Everything you need to know about getting started with the most powerful analytics engine.
          </p>
        </div>

        {/* FAQs */}
        <div className="max-w-4xl mx-auto mb-32 sm:mb-48">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <AccordionItem 
                  value={`item-${index}`} 
                  className="glass-card border-white/10 dark:border-white/[0.05] rounded px-8 overflow-hidden data-[state=open]:bg-white/[0.02] transition-all"
                >
                  <AccordionTrigger className="text-sm sm:text-lg font-black tracking-tight py-6 hover:no-underline hover:text-primary transition-colors text-left group">
                    <span className="flex items-center gap-4">
                      <div className="p-2 bg-primary/5 rounded border border-primary/20 group-hover:bg-primary/20 transition-colors">
                        <HelpCircle className="h-4 w-4 text-primary" />
                      </div>
                      {faq.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-base text-muted-foreground/70 leading-relaxed font-medium tracking-tight pb-8 pl-12 pr-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>

        {/* Final CTA */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-6xl mx-auto"
        >
          <div className="relative glass p-10 sm:p-24 rounded-[4rem] border-white/10 shadow-glow/10 overflow-hidden bg-gradient-to-tr from-white/5 to-transparent">
             {/* Background Mesh */}
             <div className="absolute top-0 right-0 w-[50rem] h-[50rem] bg-primary/10 blur-[140px] rounded-full -mr-40 -mt-40 opacity-40" />
             
            <div className="relative z-10 text-center max-w-3xl mx-auto">
              <h3 className="text-4xl sm:text-6xl font-[1000] mb-8 leading-[0.9] tracking-[-0.04em]">
                Ready to reclaim <br />
                <span className="text-primary text-shadow-glow">your intelligence?</span>
              </h3>
              <p className="text-lg sm:text-2xl text-muted-foreground/60 mb-12 font-medium tracking-tight">
                Join 500+ businesses who have already upgraded to a faster, cleaner, and more sovereign analytics engine.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
                <Link href="/signup" className="w-full sm:w-auto">
                  <Button variant="brand" size="lg" className="w-full sm:w-auto h-16 px-12 rounded-full font-black text-[10px] uppercase tracking-[0.25em] active:scale-95 group">
                    Get Started Free
                    <ArrowRight className="ml-3 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/websites/demo" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto h-16 px-12 rounded-full glass border-white/10 font-black text-[10px] uppercase tracking-[0.25em] hover:bg-white/5 transition-all active:scale-95">
                    View Live Demo
                  </Button>
                </Link>
              </div>
              
              <div className="mt-12 flex flex-wrap items-center justify-center gap-8 opacity-40 grayscale group-hover:grayscale-0 transition-all">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  No card required
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  GDPR Sovereign
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Instant Activation
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}