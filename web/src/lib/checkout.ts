import api from './api';

/**
 * Checkout is the payment provider's own page: the customer is sent there, pays, and comes back to
 * /checkout/success, which waits for the plan to switch and then opens the dashboard.
 */
export function openCheckout(url: string): void {
  window.location.assign(url);
}

const INTENT_KEY = 'seentics_checkout_intent';
const INTENT_TTL_MS = 24 * 60 * 60 * 1000;

export type BillingInterval = 'month' | 'year';
export type CheckoutIntent = { plan: string; interval: BillingInterval; discount?: string };

/**
 * A visitor who picks a paid plan before they have an account: remember the plan, and whether they
 * chose monthly or yearly, and any discount code they claimed (the founding price), across sign-up
 * (and the verification email, which may open in another tab), so the first thing they see after
 * signing up is that plan's checkout, not an empty dashboard.
 */
export function rememberCheckoutIntent(plan: string, interval: BillingInterval = 'month', discount?: string): void {
  try {
    localStorage.setItem(INTENT_KEY, JSON.stringify({ plan, interval, ...(discount ? { discount } : {}), at: Date.now() }));
  } catch {
    // storage blocked: they pick the plan again from the dashboard
  }
}

/** The remembered choice, once: it is cleared as it is read. */
export function takeCheckoutIntent(): CheckoutIntent | null {
  try {
    const raw = localStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    localStorage.removeItem(INTENT_KEY);
    const { plan, interval, discount, at } = JSON.parse(raw) as { plan?: string; interval?: string; discount?: unknown; at?: number };
    if (!plan || typeof at !== 'number' || Date.now() - at >= INTENT_TTL_MS) return null;
    return { plan, interval: interval === 'year' ? 'year' : 'month', ...(typeof discount === 'string' && discount ? { discount } : {}) };
  } catch {
    return null;
  }
}

/**
 * Buy `plan`, billed every month or year: send the customer to Lemon Squeezy's checkout. Throws with
 * the gateway's message. `discount` (the founding code) is sent only when given; a gateway that does
 * not know the field ignores it.
 */
export async function startCheckout(plan: string, interval: BillingInterval = 'month', discount?: string): Promise<void> {
  const res = await api.post('/user/billing/checkout', { plan, interval, ...(discount ? { discount } : {}) });
  const url: string | undefined = res.data?.data?.checkoutUrl;
  if (!url) throw new Error(res.data?.error ?? 'No checkout was returned');
  openCheckout(url);
}
