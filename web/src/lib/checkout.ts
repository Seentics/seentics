import api from './api';

const POLL_INTERVAL_MS = 2500;
const MAX_WAIT_MS = 60_000;

async function currentPlan(): Promise<string | null> {
  try {
    const res = await api.get('/user/billing/usage');
    return String(res.data?.data?.plan ?? 'free').toLowerCase();
  } catch {
    return null; // auth / network blip: the caller keeps waiting
  }
}

/**
 * Shows Polar's checkout in a frame over this page, so the customer pays without leaving Seentics.
 * (The gateway tells Polar which origin may embed it when it creates the checkout.) If the frame
 * cannot be created the customer is sent to the hosted checkout instead.
 *
 * Payment is confirmed by Polar's webhook, a moment after the frame reports success, so on success
 * this polls /user/billing/usage until the plan changes: `onActivated`, or `onTimeout` after 60 s.
 */
export async function openCheckout(
  url: string,
  onActivated: () => void = () => window.location.assign('/websites?checkout=success'),
  onTimeout: () => void = () => window.location.assign('/websites?checkout=success'),
  /** The card was accepted; the plan follows once Polar's webhook lands. */
  onPaid?: () => void,
): Promise<void> {
  const before = await currentPlan();

  let checkout;
  try {
    const { PolarEmbedCheckout } = await import('@polar-sh/checkout/embed');
    checkout = await PolarEmbedCheckout.create(url, {
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    });
  } catch {
    window.location.assign(url);
    return;
  }

  checkout.addEventListener('success', (event) => {
    // Stay on this page; the default would navigate to the success URL.
    event.preventDefault();
    checkout.close();
    onPaid?.();
    const startedAt = Date.now();
    const poll = async () => {
      const plan = await currentPlan();
      if (plan !== null && before !== null && plan !== before) return onActivated();
      if (Date.now() - startedAt >= MAX_WAIT_MS) return onTimeout();
      setTimeout(poll, POLL_INTERVAL_MS);
    };
    void poll();
  });
}
