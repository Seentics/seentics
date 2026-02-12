import { Button } from '@/components/ui/button';
import { CheckCircle, Zap, Star, Crown, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';
import { motion } from 'framer-motion';

const plans = [
  {
    name: "Starter",
    price: "0",
    period: "forever",
    description: "Perfect for exploring our unique analytics power.",
    icon: Star,
    popular: false,
    color: "text-primary bg-primary/10 border-primary/20",
    features: [
      "1 Website",
      "15,000 Monthly Events",
      "3 Session Recordings",
      "1 Active Heatmap",
      "1 Conversion Funnel",
      "1 Automation Workflow",
      "30 Days Data Retention",
      "Community Support"
    ]
  },
  {
    name: "Growth",
    price: "29",
    period: "month",
    description: "Scaling fast? Get the deep insights you need.",
    icon: Zap,
    popular: true,
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    features: [
      "5 Websites",
      "200,000 Monthly Events",
      "500 Session Recordings",
      "10 Active Heatmaps",
      "20 Conversion Funnels",
      "20 Active Automations",
      "1 Year Data Retention",
      "Priority Email Support"
    ]
  },
  {
    name: "Scale",
    price: "89",
    period: "month",
    description: "Advanced features for scaling agencies and businesses.",
    icon: Crown,
    popular: false,
    color: "text-violet-500 bg-violet-500/10 border-violet-500/20",
    features: [
      "15 Websites",
      "1,000,000 Monthly Events",
      "2,500 Session Recordings",
      "50 Active Heatmaps",
      "100 Active Automations",
      "100 Conversion Funnels",
      "2 Years Data Retention",
      "24/7 Priority Support"
    ]
  },
  {
    name: "Pro+",
    price: "99",
    period: "month",
    description: "Elite features for high-traffic enterprises.",
    icon: Sparkles,
    popular: false,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    features: [
      "Unlimited Websites",
      "10,000,000 Monthly Events",
      "Unlimited Everything",
      "Unlimited Heatmaps",
      "Custom Data Retention",
      "White-label Reports",
      "Dedicated Success Manager",
      "SSO & Custom Security"
    ]
  }
];

export default function Pricing() {
  const { isAuthenticated, user } = useAuth();

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
    <section id="pricing" className="py-24 bg-background border-t border-border/40">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-6">
            Simple, honest <br />
            <span className="text-primary italic">pricing.</span>
          </h2>
          <p className="text-lg text-muted-foreground/80 font-medium">
            Start for free. No credit card required. Upgrade when you need more power.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-20">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`p-6 md:p-8 rounded-2xl border ${plan.popular ? 'border-primary ring-1 ring-primary/20' : 'border-border/60'} bg-card flex flex-col relative`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-8 -translate-y-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest py-1 px-3 rounded-full">
                  Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xl font-bold mb-2 tracking-tight">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-bold tracking-tight">${plan.price}</span>
                  <span className="text-muted-foreground font-medium text-sm pl-0.5">/{plan.period === 'forever' ? 'forever' : 'mo'}</span>
                </div>
                <p className="text-sm text-muted-foreground/80 font-medium leading-relaxed">
                  {plan.description}
                </p>
              </div>

              <div className="space-y-4 mb-8 flex-grow">
                {plan.features.slice(0, 8).map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm font-medium text-foreground/80 tracking-tight">{feature}</span>
                  </div>
                ))}
              </div>

              <Link href={isAuthenticated ? "/websites" : "/signup"}>
                <Button
                  variant={plan.popular ? "brand" : "outline"}
                  className="w-full h-12 rounded-xl font-bold text-sm transition-all"
                >
                  {plan.name === 'Starter' ? 'Get Started' : `Go ${plan.name}`}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Sales Trigger */}
        <div className="max-w-4xl mx-auto p-12 rounded-2xl bg-primary/[0.03] border border-primary/10 text-center relative overflow-hidden group hover:border-primary/20 transition-all duration-500">
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-4 tracking-tight">Need something bigger?</h3>
            <p className="text-muted-foreground font-medium mb-8 max-w-xl mx-auto leading-relaxed">
              Custom infrastructure, unlimited volume, and priority support for high-traffic enterprises.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/contact" className="w-full sm:w-auto">
                <Button variant="outline" className="h-12 px-8 text-sm font-bold w-full sm:w-auto rounded-xl">
                  Contact Sales
                </Button>
              </Link>
              <Link href="/signup" className="w-full sm:w-auto">
                <Button variant="brand" className="h-12 px-8 text-sm font-bold w-full sm:w-auto rounded-xl shadow-lg shadow-primary/20">
                  Try It Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

