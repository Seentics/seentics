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

/**
 * A visitor who picks a paid plan before they have an account: remember the plan across sign-up (and
 * the verification email, which may open in another tab), so the first thing they see after signing
 * up is that plan's checkout, not an empty dashboard.
 */
export function rememberCheckoutIntent(plan: string): void {
  try {
    localStorage.setItem(INTENT_KEY, JSON.stringify({ plan, at: Date.now() }));
  } catch {
    // storage blocked: they pick the plan again from the dashboard
  }
}

/** The remembered plan, once: it is cleared as it is read. */
export function takeCheckoutIntent(): string | null {
  try {
    const raw = localStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    localStorage.removeItem(INTENT_KEY);
    const { plan, at } = JSON.parse(raw) as { plan?: string; at?: number };
    return plan && typeof at === 'number' && Date.now() - at < INTENT_TTL_MS ? plan : null;
  } catch {
    return null;
  }
}

/** Buy `plan`: send the customer to Lemon Squeezy's checkout. Throws with the gateway's message. */
export async function startCheckout(plan: string): Promise<void> {
  const res = await api.post('/user/billing/checkout', { plan });
  const url: string | undefined = res.data?.data?.checkoutUrl;
  if (!url) throw new Error(res.data?.error ?? 'No checkout was returned');
  openCheckout(url);
}
