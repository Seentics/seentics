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
      "10,000 Monthly Events",
      "1 Conversion Funnel",
      "30 Days Data Retention",
      "Real-time Dashboard",
      "Community Support"
    ]
  },
  {
    name: "Growth",
    price: "29",
    period: "per month",
    description: "Scaling fast? Get the deep insights you need.",
    icon: Zap,
    popular: true,
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    features: [
      "3 Websites",
      "100,000 Monthly Events",
      "5 Conversion Funnels",
      "3 Active Automations",
      "1 Year Data Retention",
      "Priority Email Support"
    ]
  },
  {
    name: "Scale",
    price: "79",
    period: "per month",
    description: "Dominate your market with automation.",
    icon: Crown,
    popular: false,
    color: "text-violet-500 bg-violet-500/10 border-violet-500/20",
    features: [
      "10 Websites",
      "500,000 Monthly Events",
      "Unlimited Funnels",
      "10 Active Automations",
      "2 Years Data Retention",
      "24/7 Priority Support",
      "API Access"
    ]
  },
  {
    name: "Pro+",
    price: "199",
    period: "per month",
    description: "The ultimate power for large-scale operations.",
    icon: Sparkles,
    popular: false,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    features: [
      "Unlimited Websites",
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
    <section id="pricing" className="py-24 sm:py-32 relative overflow-hidden bg-background">
      <div className="container mx-auto px-6 relative z-10">

        {/* Header */}
        <div className="text-center mb-16 sm:mb-28 px-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-6"
          >
            Investment
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-4xl sm:text-6xl  font-[1000] tracking-[-0.03em] mb-10 leading-[0.95]"
          >
            Scalable plans for <br />
            <span className="gradient-text">every stage.</span>
          </motion.h2>

          <p className="text-lg sm:text-xl text-muted-foreground/60 max-w-2xl mx-auto font-medium tracking-tight">
            Start free forever. No credit card required. Our infrastructure scales as your traffic grows.
          </p>
        </div>

        {/* Pricing Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[90rem] mx-auto mb-32"
        >
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className={`relative glass-card p-1 rounded transition-all duration-500 ${plan.popular ? 'ring-1 ring-primary/40 shadow-glow/20' : 'border-white/10'
                }`}
            >
              <div className="bg-card/30 backdrop-blur-2xl h-full rounded-[0.7rem] p-10 flex flex-col relative overflow-hidden">
                {plan.popular && (
                  <div className="absolute top-0 right-0 py-2 px-6 bg-primary text-white text-[9px] font-black uppercase tracking-[0.25em] rounded-bl-xl shadow-glow">
                    Most Popular
                  </div>
                )}

                <div className="mb-10">
                  <div className={`w-14 h-14 rounded flex items-center justify-center mb-8 border ${plan.color} shadow-sm transition-transform group-hover:scale-110`}>
                    <plan.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-black mb-2 tracking-tight">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-5xl font-black tracking-[-0.04em]">${plan.price}</span>
                    <span className="text-muted-foreground/60 font-black text-[10px] uppercase tracking-widest pl-1">/{plan.period === 'forever' ? 'forever' : 'mo'}</span>
                  </div>
                  <p className="text-muted-foreground/60 font-medium text-sm leading-relaxed tracking-tight">
                    {plan.description}
                  </p>
                </div>

                <div className="space-y-4 mb-10 flex-grow">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-4 group/item">
                      <div className="flex-shrink-0 p-1 bg-primary/10 rounded-full border border-primary/20 group-hover/item:bg-primary/20 transition-colors">
                        <CheckCircle className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-[13px] font-bold text-foreground/70 group-hover/item:text-foreground transition-colors tracking-tight">{feature}</span>
                    </div>
                  ))}
                </div>

                <Link href={isAuthenticated ? "/websites" : "/signup"} className="mt-auto">
                  <Button
                    variant={plan.popular ? "brand" : "default"}
                    className={`w-full h-14 rounded font-black text-[10px] uppercase tracking-[0.2em] transition-all ${!plan.popular && 'glass border-white/10 hover:bg-white/5 active:scale-95 text-foreground'
                      }`}
                  >
                    {plan.name === 'Starter' ? 'Start Free' : `Purchase ${plan.name}`}
                    <ArrowRight className="ml-2 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Guarantee Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="glass p-12 sm:p-20 rounded border-white/10 shadow-2xl relative overflow-hidden">
            {/* Background Mesh */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-primary/10 blur-[100px] rounded-full -ml-32 -mt-32 opacity-30" />

            <h3 className="text-3xl sm:text-4xl font-black mb-8 tracking-tight relative z-10">
              Enterprise requirements? <br />
              <span className="text-primary italic font-serif underline decoration-primary/30 decoration-4 underline-offset-8">Let's talk scale.</span>
            </h3>
            <p className="text-muted-foreground/60 mb-12 font-medium max-w-2xl mx-auto text-lg leading-relaxed tracking-tight relative z-10">
              We provide custom infrastructure, massive volume discounts, and white-labeling for heavy hitters.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 relative z-10">
              <Link href="/contact" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto h-16 px-12 rounded glass border-white/10 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/5 transition-all active:scale-95">
                  Contact Sales
                </Button>
              </Link>
              <Link href="/signup" className="w-full sm:w-auto">
                <Button variant="brand" className="w-full sm:w-auto h-16 px-12 rounded font-black text-[10px] uppercase tracking-[0.2em] active:scale-95">
                  Start Free Now
                </Button>
              </Link>
            </div>

            <div className="mt-16 pt-10 border-t border-white/5 flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 relative z-10">
              <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary opacity-60" /> No Setup Fees</span>
              <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary opacity-60" /> Cancel Anytime</span>
              <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary opacity-60" /> GDPR Sovereign</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

