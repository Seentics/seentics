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
      "5,000 Monthly Events",
      '1 Automation Workflow',
      "1 Conversion Funnel",
      "30 Days Data Retention",
      "Real-time Dashboard",
      "Community Support"
    ]
  },
  {
    name: "Growth",
    price: "15",
    period: "per month",
    description: "Scaling fast? Get the deep insights you need.",
    icon: Zap,
    popular: true,
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    features: [
      "3 Websites",
      "100,000 Monthly Events",
      "10 Conversion Funnels",
      "10 Active Automations",
      "1 Year Data Retention",
      "Priority Email Support"
    ]
  },
  {
    name: "Scale",
    price: "39",
    period: "per month",
    description: "Dominate your market with automation.",
    icon: Crown,
    popular: false,
    color: "text-violet-500 bg-violet-500/10 border-violet-500/20",
    features: [
      "10 Websites",
      "500,000 Monthly Events",
      "Unlimited Automations",
      'Unlimited Funnels',
      "3 Years Data Retention",
      "24/7 Priority Support",
      "API Access"
    ]
  },
  {
    name: "Pro+",
    price: "149",
    period: "per month",
    description: "The ultimate power for large-scale operations.",
    icon: Sparkles,
    popular: false,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    features: [
      "50 Websites",
      "5,000,000 Monthly Events",
      "Unlimited Everything",
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
    <section id="pricing" className="py-24 sm:py-48 relative overflow-hidden bg-transparent">
      <div className="container mx-auto px-6 relative z-10">

        {/* Header */}
        <div className="text-center mb-24 sm:mb-32">
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl sm:text-6xl font-black tracking-tighter mb-8 leading-[0.95] text-foreground"
          >
            Simple <br />
            <span className="text-primary italic">pricing.</span>
          </motion.h3>
          <p className="text-lg sm:text-xl text-muted-foreground/60 max-w-2xl mx-auto font-bold tracking-tight">
            Start for free. No credit card required. Upgrade when you're ready for more power.
          </p>
        </div>

        {/* Pricing Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-24"
        >
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className={`p-10 rounded-xl bg-card border ${plan.popular ? 'border-primary/30 shadow-2xl shadow-primary/5' : 'border-border'} flex flex-col relative overflow-hidden`}
            >
                {plan.popular && (
                  <div className="absolute top-0 right-0 py-2.5 px-8 bg-primary text-primary-foreground text-[11px] font-bold tracking-wider rounded-bl-2xl">
                    Popular
                  </div>
                )}

                <div className="mb-10">
                  <h3 className="text-3xl font-black mb-2 tracking-tighter text-foreground">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-5xl font-black tracking-tighter text-foreground">${plan.price}</span>
                    <span className="text-muted-foreground/40 font-bold text-sm pl-1">/{plan.period === 'forever' ? 'forever' : 'month'}</span>
                  </div>
                  <p className="text-muted-foreground/60 font-bold text-sm leading-relaxed tracking-tight">
                    {plan.description}
                  </p>
                </div>

                <div className="space-y-4 mb-10 flex-grow">
                  {plan.features.slice(0, 5).map((feature, i) => (
                    <div key={i} className="flex items-center gap-4 group/item">
                      <div className="flex-shrink-0 p-1 bg-primary/10 rounded-full border border-primary/20">
                        <CheckCircle className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-bold text-foreground/70 tracking-tight">{feature}</span>
                    </div>
                  ))}
                </div>

                <Link href={isAuthenticated ? "/websites" : "/signup"}>
                  <Button
                    variant={plan.popular ? "brand" : "outline"}
                    className={`w-full h-16 rounded-xl font-bold text-lg transition-all ${!plan.popular && 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700 text-foreground shadow-lg shadow-slate-200/50 dark:shadow-none'
                      }`}
                  >
                    {plan.name === 'Starter' ? 'Start for free' : `Join ${plan.name} plan`}
                  </Button>
                </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Compact Sales Trigger */}
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto p-12 rounded-xl bg-slate-950 text-white text-center relative overflow-hidden"
        >
             <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute top-[-50%] left-[-20%] w-[80%] h-[150%] bg-primary/10 blur-[100px] rounded-full" />
            </div>
            <h3 className="text-3xl font-black mb-6 tracking-tighter relative z-10">Running at scale?</h3>
            <p className="text-slate-400 font-bold mb-10 max-w-xl mx-auto relative z-10">
                Custom infrastructure and unlimited volume for high-traffic websites. Let's build a plan that fits your business.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 relative z-10">
                <Link href="/contact" className="w-full sm:w-auto">
                    <Button variant="outline" className="h-16 px-12 bg-transparent border-slate-800 hover:bg-white/5 text-lg font-bold w-full sm:w-auto rounded-xl">
                        Contact sales
                    </Button>
                </Link>
                <Link href="/signup" className="w-full sm:w-auto">
                    <Button variant="brand" className="h-16 px-12 text-lg font-bold w-full sm:w-auto rounded-xl shadow-xl shadow-primary/20">
                        Start for free
                    </Button>
                </Link>
            </div>
        </motion.div>
      </div>
    </section>
  );
}

