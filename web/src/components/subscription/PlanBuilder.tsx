'use client';

import React from 'react';
import { ArrowRight, Check, ChevronDown, Loader2, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlans } from '@/features/plans/queries';
import type { BillingInterval, FoundingSpots, Plan } from '@/features/plans/types';
import {
  COMPARE_GROUPS, FOUNDING_OFFER, type FoundingNote, OFFER_YEARLY, TIER_PITCH, cardSectionsFor, formatMoney, foundingNote, foundingPrice, monthlyPrice, yearlySavingLabel,
} from '@/features/plans/pricing-spec';
import { cn } from '@/lib/utils';

export interface PlanSelection {
  /** A real plan id from gateway's catalog (`free`, `starter`, `pro`, `agency`) — gateway validates it at checkout. */
  plan: string;
  /** What the customer will pay each month on this interval ($0 for Free). */
  price: number;
  interval: BillingInterval;
  /** A discount code the visitor claimed: the founding code (FOUNDING_OFFER), on Pro or Agency. */
  discount?: string;
}

interface PlanBuilderProps {
  onSubscribe?: (selection: PlanSelection) => void;
  loading?: boolean;
  /** The signed-in account's plan id; a visitor has none. */
  currentPlan?: string;
  /** How the signed-in account is billed; the matching card reads "Current plan". */
  currentInterval?: BillingInterval;
  /** The founding offer's spots left (useFoundingSpots); without them the box shows the limit only. */
  founding?: FoundingSpots | null;
}

const CTA: Record<Plan['tier'], string> = { free: 'Start free', starter: 'Get Starter', pro: 'Get Pro', agency: 'Get Agency' };

/**
 * Free, Starter, Pro and Agency, from gateway's GET /api/v1/plans: a card each with one short list
 * (pricing-spec.ts), a Monthly / Yearly toggle, and the full comparison behind "Compare all features".
 * An older catalogue without Agency shows its three plans in three columns.
 * Monthly is the default; Yearly shows the year's price as a monthly figure with the yearly total
 * beside it.
 */
export function PlanBuilder({ onSubscribe, loading, currentPlan, currentInterval, founding: spots }: PlanBuilderProps) {
  const { data: plans, isLoading, isError } = usePlans();
  const [comparing, setComparing] = React.useState(false);
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);
  const [chosen, setChosen] = React.useState<BillingInterval>('month');
  // The toggle only means something once yearly is offered (OFFER_YEARLY) and the catalogue has a
  // yearly price. Until then every plan is monthly and nothing is offered that cannot be bought.
  // Once every founding spot is taken the box goes, Claim button and all.
  const note = foundingNote(spots);
  const hasYearly = OFFER_YEARLY && !!plans?.some((p) => p.priceYearly != null);
  const interval: BillingInterval = hasYearly ? chosen : 'month';

  /**
   * While the founding offer is open, buying Pro or Agency carries its code, so the checkout opens
   * with the 30% already applied: nobody has to find and type it. `price` is a month's worth, as for
   * any selection.
   */
  const handleSubscribe = (plan: Plan) => {
    if (!onSubscribe) return;
    setLoadingPlan(plan.id);
    if (note.show && FOUNDING_OFFER.plans.includes(plan.tier)) {
      const price = foundingPrice(plan, interval);
      onSubscribe({ plan: plan.id, price: interval === 'year' ? price / 12 : price, interval, discount: FOUNDING_OFFER.code });
      return;
    }
    onSubscribe({ plan: plan.id, price: monthlyPrice(plan, interval), interval });
  };

  const renderCard = (plan: Plan) => {
    const featured = plan.tier === 'pro';
    const agency = plan.tier === 'agency';
    const paid = plan.priceMonthly > 0;
    // A card is the current plan when it is the plan, and for the paid ones the interval too: the
    // other interval is a switch the customer can make.
    const isCurrent = !!currentPlan && currentPlan === plan.id && (!paid || !currentInterval || currentInterval === interval);
    const yearly = paid && interval === 'year' && plan.priceYearly != null;
    return (
      <div
        key={plan.id}
        className={cn(
          // Separate cards on small screens; from lg one panel, the plans side by side with a
          // divider between them (the panel draws the border, so each column is wider). Pro is told
          // apart by its badge alone.
          'relative flex min-w-0 flex-col rounded-2xl border border-border bg-card p-6',
          'lg:rounded-none lg:border-0 lg:bg-transparent lg:p-6 xl:p-7',
          featured && 'border-primary lg:border-0',
        )}
      >
        <div className="mb-3 h-5">
          {featured && (
            <span className="inline-flex rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
              Most popular
            </span>
          )}
          {agency && (
            <span className="inline-flex rounded-full bg-foreground px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-background">
              For agencies
            </span>
          )}
        </div>

        <h3 className="text-lg font-semibold">{plan.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground lg:min-h-10">{TIER_PITCH[plan.tier]}</p>

        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="text-4xl font-bold tracking-tight">{formatMoney(monthlyPrice(plan, interval))}</span>
          <span className="text-sm text-muted-foreground">/month</span>
        </div>
        {/* One short line: the saving is on the Yearly toggle, not repeated on every card. */}
        <p className="mt-1 h-5 text-[13px] text-muted-foreground">
          {!paid ? 'Free forever' : yearly ? `${formatMoney(plan.priceYearly!)} billed yearly` : 'Billed monthly'}
        </p>

        <Button
          onClick={() => handleSubscribe(plan)}
          disabled={loading || isCurrent}
          variant={featured ? 'default' : 'outline'}
          className={cn('mt-4 w-full gap-1.5', !featured && 'bg-accent text-accent-foreground hover:bg-accent/70')}
        >
          {loading && loadingPlan === plan.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isCurrent ? (
            'Current plan'
          ) : (
            <>{CTA[plan.tier] ?? `Get ${plan.name}`} <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>

        <div className="mt-6 space-y-6 border-t border-border pt-6">
          {cardSectionsFor(plan).map((section) => (
            <div key={section.title}>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{section.title}</p>
              <ul className="space-y-2.5">
                {section.items.map((item) => (
                  <li key={item.label} className="flex gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      {item.value && <span className="font-semibold text-foreground">{item.value} </span>}
                      {item.href ? (
                        <a href={item.href} className="font-medium text-primary hover:underline">{item.label}</a>
                      ) : (
                        <span className="text-muted-foreground">{item.label}</span>
                      )}
                      {item.soon && (
                        <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Soon</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const savingLabel = plans ? yearlySavingLabel(plans) : '';

  return (
    <div className="w-full">
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <p className="py-16 text-center text-sm text-muted-foreground">Couldn&apos;t load pricing right now. Please refresh the page.</p>
      )}

      {plans && (
        <>
          {hasYearly && (
          <div className="mb-8 flex justify-center">
            <div role="group" aria-label="Billing interval" className="inline-flex rounded-full border border-border bg-card p-1 text-sm font-medium">
              {(['month', 'year'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={interval === value}
                  onClick={() => setChosen(value)}
                  className={cn(
                    'rounded-full px-5 py-1.5 transition-colors',
                    interval === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {value === 'month' ? 'Monthly' : `Yearly${savingLabel ? ` (${savingLabel})` : ''}`}
                </button>
              ))}
            </div>
          </div>
          )}

          {note.show && <FoundingBanner plans={plans} note={note} />}

          {/* Four plans side by side from lg; an older catalogue's three keep three columns. */}
          <div
            className={cn(
              'grid grid-cols-1 gap-6 md:grid-cols-2',
              'lg:gap-0 lg:divide-x lg:divide-border lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border lg:bg-card',
              plans.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
            )}
          >
            {plans.map(renderCard)}
          </div>

          <div className="mt-8 flex justify-center">
            <Button variant="ghost" onClick={() => setComparing((open) => !open)} aria-expanded={comparing} className="gap-1.5">
              {comparing ? 'Hide feature comparison' : 'Compare all features'}
              <ChevronDown className={cn('h-4 w-4 transition-transform', comparing && 'rotate-180')} />
            </Button>
          </div>

          {comparing && <CompareTable plans={plans} interval={interval} />}
        </>
      )}
    </div>
  );
}

/**
 * The founding offer in one line above the cards. No buttons of its own: Get Pro and Get Agency
 * apply the code while the offer is open. The availability part reads "first 50 customers" until
 * the real count is worth showing (foundingNote).
 */
function FoundingBanner({ plans, note }: { plans: Plan[]; note: Extract<FoundingNote, { show: true }> }) {
  const names = plans.filter((p) => FOUNDING_OFFER.plans.includes(p.tier) && p.priceMonthly > 0).map((p) => p.name);
  if (names.length === 0) return null;
  const availability = note.text.startsWith('Limited to the ') ? note.text.replace('Limited to the ', '') : note.text;
  return (
    <p data-testid="founding-offer" className="mx-auto mb-6 max-w-3xl text-center text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">Founding offer:</span> {FOUNDING_OFFER.percentOff}% off {names.join(' and ')} for life with code{' '}
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] font-semibold text-foreground">{FOUNDING_OFFER.code}</code>
      <span aria-hidden> · </span>
      <span
        data-testid="founding-spots"
        data-emphasised={note.emphasised || undefined}
        className={cn(note.emphasised && 'font-semibold text-destructive')}
      >
        {availability}
      </span>
    </p>
  );
}

function CompareTable({ plans, interval }: { plans: Plan[]; interval: BillingInterval }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="w-2/5 px-5 py-4 text-left font-medium text-muted-foreground" />
            {plans.map((plan) => (
              <th key={plan.id} className={cn('px-4 py-4 text-center font-semibold', plan.tier === 'pro' && 'text-primary', plan.tier === 'agency' && 'bg-muted/40')}>
                {plan.name}
                <span className="block text-xs font-normal text-muted-foreground">{plan.priceMonthly > 0 ? `${formatMoney(monthlyPrice(plan, interval))}/mo` : 'Free'}</span>
              </th>
            ))}
          </tr>
        </thead>
        {COMPARE_GROUPS.map((group) => (
          <tbody key={group.title}>
            <tr className="bg-muted/40">
              <th colSpan={plans.length + 1} className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </th>
            </tr>
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
