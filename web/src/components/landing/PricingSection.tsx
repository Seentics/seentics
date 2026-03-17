"use client";

import React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function formatSpec(label: string, value: string) {
  switch (label) {
    case "Websites":
      return `${value} ${value === "1" ? "website" : "websites"}`;
    case "Monthly events":
      return `${value} monthly events`;
    case "Data retention":
      return `${value} data retention`;
    case "Team members":
      return `${value} ${value === "1" ? "team member" : "team members"}`;
    case "API and SDKs":
      return value === "Included" ? "API and SDK access" : "No Raw APIs or SDKs";
    case "Rate limit":
      return value === "Standard" ? "Standard rate limit" : `${value} rate limit`;
    case "Support":
      return `${value} support`;
    default:
      return `${value} ${label.toLowerCase()}`;
  }
}

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "For personal projects and small launches",
    cta: "Start free",
    href: "/signup",
    specs: [
      { label: "Websites", value: "1" },
      { label: "Monthly events", value: "10K" },
      { label: "Data retention", value: "30 days" },
      { label: "Team members", value: "1" },
      { label: "API and SDKs", value: "Not included" },
      { label: "Rate limit", value: "Standard" },
    ],
  },
  {
    name: "Starter",
    price: "$5",
    period: "/month",
    description: "For early-stage products that need API access",
    cta: "Choose Starter",
    href: "/signup",
    specs: [
      { label: "Websites", value: "3" },
      { label: "Monthly events", value: "100K" },
      { label: "Data retention", value: "2 years" },
      { label: "Team members", value: "2" },
      { label: "API and SDKs", value: "Included" },
      { label: "Rate limit", value: "100 req/s" },
    ],
  },
  {
    name: "Growth",
    description: "For growing teams and production workloads",
    price: "$15",
    period: "/month",
    popular: true,
    cta: "Choose Growth",
    href: "/signup",
    specs: [
      { label: "Websites", value: "10" },
      { label: "Monthly events", value: "1M" },
      { label: "Data retention", value: "3 years" },
      { label: "Team members", value: "10" },
      { label: "API and SDKs", value: "Included" },
      { label: "Rate limit", value: "1K req/s" },
    ],
  },
  {
    name: "Agency",
    description: "For agencies, enterprise teams, and custom deployment needs",
    priceLabel: "Contact us",
    cta: "Talk to sales",
    href: "/contact",
    specs: [
      { label: "Websites", value: "Unlimited" },
      { label: "Monthly events", value: "Unlimited" },
      { label: "Data retention", value: "Custom" },
      { label: "Team members", value: "Unlimited" },
      { label: "API and SDKs", value: "Included" },
      { label: "Support", value: "Priority + SLA" },
    ],
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-xs font-semibold uppercase tracking-widest text-primary mb-3"
          >
            Pricing
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
          >
            Simple, Transparent Pricing
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-muted-foreground text-lg"
          >
            Start free. Scale as you grow. No hidden fees.
          </motion.p>
        </div>

        <div className="grid items-stretch gap-4 lg:grid-cols-4 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className={`relative flex h-full flex-col overflow-visible rounded-3xl border p-6 md:p-7 transition-all ${
                plan.popular
                  ? "border-primary/25 bg-card shadow-[0_18px_40px_-28px_rgba(37,99,235,0.28)]"
                  : "border-border/60 bg-card shadow-sm"
              }`}
            >
              {plan.popular && (
                <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
                  <div className="rounded-full border border-primary/30 bg-background px-3 py-1 text-[11px] font-semibold text-primary shadow-sm">
                    Most Popular
                  </div>
                </div>
              )}

              {plan.popular && (
                <div className="absolute inset-x-0 top-0 h-1 bg-primary/80" />
              )}

              <div className="mb-6 min-h-[132px]">
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  {plan.name}
                </p>
                {"priceLabel" in plan ? (
                  <div className="flex min-h-[48px] items-end text-foreground">
                    <span className="text-3xl font-semibold tracking-tight">
                      {plan.priceLabel}
                    </span>
                  </div>
                ) : (
                  <div className="flex min-h-[48px] items-end gap-2 text-foreground">
                    <span className="text-4xl font-semibold tracking-tight">
                      {plan.price}
                    </span>
                    <span className="pb-1 text-sm text-muted-foreground">
                      {plan.period}
                    </span>
                  </div>
                )}
                <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
                  {plan.description}
                </p>
              </div>

              <div className="flex-1 border-t border-border/50 pt-6 space-y-3">
                {plan.specs.map((spec) => (
                  <div key={spec.label} className="flex items-start gap-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm leading-6 text-foreground/90">
                      {formatSpec(spec.label, spec.value)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-7">
                <Button
                  asChild
                  variant={plan.popular ? "default" : "outline"}
                  className={`h-11 w-full rounded-xl text-sm font-semibold ${
                    plan.popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : plan.name === "Agency"
                        ? "border-foreground bg-foreground text-background hover:bg-foreground/90"
                        : "border-border bg-background text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Self-hosted note */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 max-w-2xl mx-auto p-6 rounded-lg border border-border/50 bg-muted/30 text-center"
        >
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Prefer self-hosted?</strong>{" "}
            Deploy on your own infrastructure for free. The entire platform is
            open source.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
