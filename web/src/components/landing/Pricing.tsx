import { Button } from '@/components/ui/button';
import { Check, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';
import { motion } from 'framer-motion';
import { isEnterprise } from '@/lib/features';

const plans = [
  {
    name: 'Starter',
    price: '0',
    period: 'forever',
    description: 'For side projects and personal sites.',
    popular: false,
    features: [
      '1 Website',
      '15,000 Monthly Events',
      '3 Session Recordings',
      '1 Heatmap',
      '1 Funnel',
      '1 Automation',
      '30 Days Retention',
    ],
  },
  {
    name: 'Growth',
    price: '29',
    period: 'month',
    description: 'For growing businesses that need deeper insights.',
    popular: true,
    features: [
      '5 Websites',
      '200,000 Monthly Events',
      '500 Session Recordings',
      '10 Heatmaps',
      '20 Funnels',
      '20 Automations',
      '1 Year Retention',
    ],
  },
  {
    name: 'Scale',
    price: '89',
    period: 'month',
    description: 'For agencies and scaling teams.',
    popular: false,
    features: [
      '15 Websites',
      '1,000,000 Monthly Events',
      '2,500 Session Recordings',
      '50 Heatmaps',
      '100 Funnels',
      '100 Automations',
      '2 Years Retention',
    ],
  },
  {
    name: 'Pro+',
    price: '99',
    period: 'month',
    description: 'For high-traffic enterprises.',
    popular: false,
    features: [
      'Unlimited Websites',
      '10,000,000 Monthly Events',
      'Unlimited Recordings',
      'Unlimited Heatmaps',
      'Custom Retention',
      'White-label Reports',
      'SSO & Dedicated Support',
    ],
  },
];

export default function Pricing() {
  if (!isEnterprise) return null;

  const { isAuthenticated } = useAuth();

  return (
    <section id="pricing" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
          >
            Simple, honest pricing
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-muted-foreground text-lg"
          >
            Start free. Upgrade when you need more. No surprises.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-16">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className={`rounded-xl border p-6 flex flex-col bg-card ${
                plan.popular
                  ? 'border-primary/40 ring-1 ring-primary/20'
                  : 'border-border/50'
              }`}
            >
              {plan.popular && (
                <span className="text-[11px] font-semibold text-primary mb-3">Most popular</span>
              )}

              <h3 className="text-lg font-semibold text-foreground mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-0.5 mb-2">
                <span className="text-3xl font-bold tracking-tight text-foreground">${plan.price}</span>
                <span className="text-sm text-muted-foreground">
                  /{plan.period === 'forever' ? 'forever' : 'mo'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>

              <div className="space-y-3 mb-6 flex-grow">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5">
                    <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>

              <Link href={isAuthenticated ? '/websites' : '/signup'} className="mt-auto">
                <Button
                  variant={plan.popular ? 'default' : 'outline'}
                  className="w-full h-10 text-sm font-medium rounded-lg"
                >
                  {plan.name === 'Starter' ? 'Get Started' : `Go ${plan.name}`}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Enterprise CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="max-w-2xl mx-auto text-center"
        >
          <p className="text-muted-foreground mb-4">
            Need custom infrastructure, unlimited volume, or priority support?
          </p>
          <Link href="/contact">
            <Button variant="outline" className="h-10 px-6 text-sm font-medium rounded-lg">
              Contact Sales <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
