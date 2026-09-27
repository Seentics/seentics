'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronDown, Loader2, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlans } from '@/features/plans/queries';
import { PLAN_FAMILY_LABEL, planFamily, type Plan, type PlanFamily } from '@/features/plans/types';
import {
  FAMILY_TAB,
  TIER_PITCH,
  cardSectionsFor,
  compareGroupsFor,
  supportFor,
} from '@/features/plans/pricing-spec';
import { LOGOS, SEPARATE_TOTAL, SUITE_COMPARED_TIER, SUITE_REPLACES, logoFill } from '@/features/plans/competitors';
import { cn } from '@/lib/utils';

export interface PlanSelection {
  /** A real plan id from gateway's catalog, e.g. `core-free`/`suite-pro` — opaque here, gateway validates it at checkout. */
  plan: string;
  price: number;
  billing: 'monthly' | 'yearly';
}

interface PlanBuilderProps {
  onSubscribe?: (selection: PlanSelection) => void;
  loading?: boolean;
  currentPlan?: string;
  /** If true, shows agency plans instead of individual */
  mode?: 'individual' | 'agency';
  /**
   * Which price ladders to offer, one tab each, first selected. seentics.com
   * shows Suite + Analytics; the Uptime and Observability sites show Suite +
   * their own product. A single family renders without tabs.
   */
  families?: PlanFamily[];
}

/** "Suite Pro", "Analytics Starter" — one string, since the button it goes
 *  in is a flex row and separate text nodes would each get the gap. */
function planLabel(plan: Plan): string {
  return `${PLAN_FAMILY_LABEL[planFamily(plan)]} ${plan.tier.charAt(0).toUpperCase()}${plan.tier.slice(1)}`;
}

/**
 * Prices and limits come from gateway's GET /api/v1/plans; what a card shows
 * for them is pricing-spec.ts. Cards are deliberately short — price, a few
 * allowances, support — and everything else lives in the comparison table
 * behind "Compare all features", so a card can be read at a glance.
 */
export function PlanBuilder({ onSubscribe, loading, currentPlan, mode = 'individual', families = ['suite', 'core'] }: PlanBuilderProps) {
  const { data: allPlans, isLoading, isError } = usePlans();
  const [family, setFamily] = React.useState<PlanFamily>(families[0] ?? 'suite');
  const [comparing, setComparing] = React.useState(false);
  // A caller switching `families` (e.g. /pricing?product=uptime) resets the tab.
  const familiesKey = families.join(',');
  React.useEffect(() => {
    setFamily(families[0] ?? 'suite');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familiesKey]);
  const plans = allPlans?.filter((p) => planFamily(p) === family);
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);
  const tab = FAMILY_TAB[family];

  const handleSubscribe = (plan: Plan) => {
    if (!onSubscribe) return;
    setLoadingPlan(plan.id);
    onSubscribe({ plan: plan.id, price: plan.priceMonthly, billing: 'monthly' });
  };

  const renderCard = (plan: Plan) => {
    const popular = plan.tier === 'pro';
    // Only a signed-in caller passes currentPlan; a visitor on the landing
    // page has no current plan, so Free stays a real "Get Started".
    const isCurrent =
      !!currentPlan &&
      (currentPlan === plan.id || (plan.tier === 'free' && (currentPlan === 'free' || currentPlan.endsWith('-free'))));
    const isFree = plan.priceMonthly === 0;

    return (
      <div
        key={plan.id}
        className={cn(
          'relative flex flex-col rounded-2xl border bg-card p-6',
          popular ? 'border-primary shadow-lg shadow-primary/10 ring-1 ring-primary' : 'border-border',
        )}
      >
        {popular && (
          <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
            Most popular
          </span>
        )}

        <h3 className="text-lg font-semibold capitalize">{plan.tier}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{TIER_PITCH[plan.tier]}</p>

        <div className="mt-5 flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight">{isFree ? '$0' : `$${plan.priceMonthly}`}</span>
          <span className="text-sm text-muted-foreground">/month</span>
        </div>

        <Button
          onClick={() => handleSubscribe(plan)}
          disabled={loading || isCurrent}
          variant={popular ? 'default' : 'outline'}
          // The outline variant's hover fill as its resting look: an empty
          // outline read as disabled next to the filled Pro button.
          className={cn('mt-5 w-full gap-1.5', !popular && 'bg-accent text-accent-foreground hover:bg-accent/70')}
        >
          {loading && loadingPlan === plan.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isCurrent ? (
            'Current plan'
          ) : isFree ? (
            <>Start free <ArrowRight className="h-4 w-4" /></>
          ) : (
            <>{`Get ${planLabel(plan)}`} <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>

        <div className="mt-6 flex-1 space-y-5 border-t border-border pt-6">
          {cardSectionsFor(family, plan).map((section, index) => (
            <div key={section.title ?? index}>
              {section.title && (
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{section.title}</p>
              )}
              <ul className="space-y-2.5">
                {section.items.map((item) => (
                  <li key={item.label} className="flex items-baseline gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 translate-y-0.5 text-primary" />
                    <span>
                      {item.value && <span className="font-semibold text-foreground">{item.value} </span>}
                      <span className="text-muted-foreground">{item.label}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          {supportFor(plan.tier)}
          {plan.tier === 'business' && (
            <>
              {' · '}
              <Link href="/contact" className="underline underline-offset-2 hover:text-foreground">
                Contact us for more
              </Link>
            </>
          )}
        </p>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      {families.length > 1 && (
        <div className="mb-10 flex flex-col items-center gap-4">
          <div role="tablist" aria-label="Choose a plan type" className="grid w-full max-w-sm grid-cols-2 gap-1 rounded-xl border border-border bg-muted/60 p-1 shadow-sm">
            {families.map((f) => {
              const active = family === f;
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFamily(f)}
                  className={cn(
                    'relative rounded-lg px-3 py-2 text-center transition-all',
                    active
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                  )}
                >
                  <span className="block text-sm font-semibold">{FAMILY_TAB[f].label}</span>
                  <span className={cn('block text-[11px]', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {FAMILY_TAB[f].caption}
                  </span>
                  {f === 'suite' && (
                    <span className="absolute -right-2 -top-2 rounded-full bg-emerald-500 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm">
                      Best value
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="max-w-xl text-center text-base text-muted-foreground">{tab.lead}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Couldn&apos;t load pricing right now. Please refresh the page.
        </p>
      )}

      {plans && (
        <>
          <div
            className={cn(
              'grid gap-5 pt-3',
              mode === 'agency' ? 'mx-auto max-w-3xl grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
            )}
          >
            {plans.map(renderCard)}
          </div>

          {family === 'suite' && <SuiteReplaces plans={plans} />}

          <p className="mt-8 text-center text-sm text-muted-foreground">{tab.includes}</p>

          <div className="mt-6 flex justify-center">
            <Button variant="ghost" onClick={() => setComparing((open) => !open)} aria-expanded={comparing} className="gap-1.5">
              {comparing ? 'Hide feature comparison' : 'Compare all features'}
              <ChevronDown className={cn('h-4 w-4 transition-transform', comparing && 'rotate-180')} />
            </Button>
          </div>

          {comparing && <CompareTable family={family} plans={plans} />}
        </>
      )}

      <p className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Cancel anytime</span>
        <span className="flex items-center gap-1"><Check className="h-3 w-3" /> No hidden fees</span>
        <span className="flex items-center gap-1"><Check className="h-3 w-3" /> 30-day money back</span>
      </p>
    </div>
  );
}

function CompareTable({ family, plans }: { family: PlanFamily; plans: Plan[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="w-1/3 px-5 py-4 text-left font-medium text-muted-foreground" />
            {plans.map((plan) => (
              <th key={plan.id} className={cn('px-4 py-4 text-center font-semibold', plan.tier === 'pro' && 'text-primary')}>
                <span className="capitalize">{plan.tier}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {plan.priceMonthly === 0 ? '$0' : `$${plan.priceMonthly}`}/mo
                </span>
              </th>
            ))}
          </tr>
        </thead>
        {compareGroupsFor(family).map((group, index) => (
          <tbody key={group.title ?? index}>
            {group.title && (
              <tr className="bg-muted/40">
                <th colSpan={plans.length + 1} className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </th>
              </tr>
            )}
            {group.rows.map((row) => (
              <tr key={row.label} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3 text-muted-foreground">{row.label}</td>
                {plans.map((plan) => {
                  const value = row.value(plan);
                  return (
                    <td key={plan.id} className="px-4 py-3 text-center font-medium">
                      {value === true ? (
                        <Check className="mx-auto h-4 w-4 text-primary" aria-label="Included" />
                      ) : value === false ? (
                        <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-label="Not included" />
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/**
 * The Suite's strongest argument, made concretely: the separate tools a team
 * would pay for instead, logo by logo, against one Suite plan's price.
 */
function SuiteReplaces({ plans }: { plans: Plan[] }) {
  const suite = plans.find((plan) => plan.tier === SUITE_COMPARED_TIER);
  if (!suite) return null;
  const saving = SEPARATE_TOTAL - suite.priceMonthly;

  return (
    <div className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="mb-6 text-center">
        <h3 className="text-lg font-semibold">What Seentics Suite Pro replaces</h3>
        <p className="mt-1 text-sm text-muted-foreground">The tools a team would otherwise pay for, one bill each.</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SUITE_REPLACES.map((tool) => (
          <li key={tool.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-4">
            <svg
              role="img"
              aria-label={`${tool.name} logo`}
              viewBox="0 0 24 24"
              className="h-8 w-8 shrink-0 text-foreground"
              fill={logoFill(tool.id) ?? 'currentColor'}
            >
              <path d={LOGOS[tool.id].path} />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{tool.name}</p>
              <p className="truncate text-xs text-muted-foreground">{tool.role}</p>
            </div>
            <p className="ml-auto text-sm font-semibold tabular-nums">${tool.priceMonthly}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col items-center justify-center gap-2 text-center sm:flex-row sm:gap-6">
        <p className="text-sm text-muted-foreground">
          Separately: <span className="font-semibold text-foreground line-through decoration-red-500/70 decoration-2">${SEPARATE_TOTAL}+/month</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Seentics Suite Pro: <span className="text-base font-bold text-primary">${suite.priceMonthly}/month</span>
        </p>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          Save ${saving}+ every month
        </span>
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Vendors&apos; published entry prices, September 2026. Separate tools also mean separate logins, bills and
        data that doesn&apos;t link up — Seentics connects logs, traces, uptime and analytics in one place.
      </p>
    </div>
  );
}
