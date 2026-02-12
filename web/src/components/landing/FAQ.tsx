import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { HelpCircle, MessageCircle, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';

const faqs = [
	{
		question: 'Is it really free?',
		answer:
			'Yes. Our Starter plan is 100% free for a single website. No credit card required. We believe high-quality analytics should be accessible to everyone.',
	},
	{
		question: 'Will it slow down my site?',
		answer:
			'No. Our script is ultra-lightweight (under 2KB). It\'s designed for performance and won\'t affect your page load speed or SEO.',
	},
	{
		question: 'Is my data safe and private?',
		answer:
			'Absolutely. We don\'t use cookies or collect personal data. Everything is built to be private and compliant with global regulations.',
	},
	{
		question: 'Can I import from Google Analytics?',
		answer:
			'Yes. We have a simple tool to bring your data over from Google Analytics (UA or GA4) so you don\'t lose your history.',
	},
	{
		question: 'Do you offer custom plans?',
		answer:
			'We do. For high-volume sites or specific needs, we offer custom infrastructure and volume discounts. Contact us to learn more.',
	},
];

export default function FAQ() {
	const { isAuthenticated } = useAuth();

	return (
		<section id="faq" className="py-24 bg-background relative overflow-hidden">
			<div className="container mx-auto px-6 relative z-10">
				{/* Header Section */}
				<div className="text-center max-w-3xl mx-auto mb-20">
					<motion.h2
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						className="text-3xl md:text-5xl font-bold tracking-tight mb-6"
					>
						Common questions. <br />
						<span className="text-primary italic">Instant answers.</span>
					</motion.h2>
					<p className="text-lg text-muted-foreground/80 font-medium">
						Everything you need to know about scaling your digital intelligence.
					</p>
				</div>

				{/* FAQs */}
				<div className="max-w-3xl mx-auto mb-32">
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
									className="bg-card border-border/50 rounded-2xl px-8 border overflow-hidden transition-all shadow-sm"
								>
									<AccordionTrigger className="text-base font-bold py-6 hover:no-underline hover:text-primary transition-colors text-left group">
										<span className="flex items-center gap-4">
											<HelpCircle className="h-4 w-4 text-primary opacity-60" />
											{faq.question}
										</span>
									</AccordionTrigger>
									<AccordionContent className="text-[15px] text-muted-foreground/80 leading-relaxed font-medium pb-8 pl-8 pr-4">
										{faq.answer}
									</AccordionContent>
								</AccordionItem>
							</motion.div>
						))}
					</Accordion>
				</div>

				{/* Final CTA */}
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					className="max-w-5xl mx-auto"
				>
					<div className="relative p-12 md:p-24 rounded-[3rem] border border-primary/10 overflow-hidden bg-primary/[0.02]">
						<div className="relative z-10 text-center max-w-3xl mx-auto">
							<h3 className="text-3xl md:text-6xl font-bold mb-8 leading-tight tracking-tight text-foreground">
								Ready to reclaim <br />
								<span className="text-primary italic">your intelligence?</span>
							</h3>
							<p className="text-lg md:text-xl text-muted-foreground/80 mb-12 font-medium">
								Join 500+ businesses who have already upgraded to a faster, cleaner, and more sovereign analytics engine.
							</p>

							<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
								<Link href={isAuthenticated ? '/websites' : '/signup'} className="w-full sm:w-auto">
									<Button
										variant="brand"
										size="lg"
										className="w-full sm:w-auto h-14 px-10 rounded-xl font-bold text-base shadow-xl shadow-primary/20"
									>
										{isAuthenticated ? 'Go to dashboard' : 'Get started free'}
										<ArrowRight className="ml-2 h-5 w-5" />
									</Button>
								</Link>
								<Link href="/websites/demo" className="w-full sm:w-auto">
									<Button
										size="lg"
										variant="outline"
										className="w-full sm:w-auto h-14 px-10 rounded-xl font-bold text-base bg-background"
									>
										View live demo
									</Button>
								</Link>
							</div>

							<div className="mt-12 flex flex-wrap items-center justify-center gap-8 opacity-60">
								<div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest">
									<CheckCircle className="h-4 w-4 text-primary" />
									No card required
								</div>
								<div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest">
									<CheckCircle className="h-4 w-4 text-primary" />
									GDPR Sovereign
								</div>
								<div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest">
									<CheckCircle className="h-4 w-4 text-primary" />
									Instant activation
								</div>
							</div>
						</div>
					</div>
				</motion.div>
			</div>
		</section>
	);
}