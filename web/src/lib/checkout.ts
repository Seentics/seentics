import api from './api';

const POLL_INTERVAL_MS = 2500;
const MAX_WAIT_MS = 60_000;

/**
 * Opens the checkout URL in a new tab and polls /user/billing/usage in the
 * background. Calls onActivated() as soon as the plan changes (i.e. the
 * webhook has been processed). Calls onTimeout() after 60 s if no change.
 */
export function openCheckout(
  rawUrl: string,
  onActivated?: () => void,
  onTimeout?: () => void,
) {
  let url = rawUrl;

  // Add test mode on localhost
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    if (!url.includes('test=1')) {
      url += (url.includes('?') ? '&' : '?') + 'test=1';
    }
  }

  // Open in a new tab — LS shows its own confirmation page there,
  // while this tab keeps running and polls for the plan change.
  window.open(url, '_blank');

  if (!onActivated) return;

  let initialPlan: string | null = null;
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout>;

  async function poll() {
    try {
      const res = await api.get('/user/billing/usage');
      const plan: string = (res.data?.data?.plan ?? 'starter').toLowerCase();

      if (initialPlan === null) {
        initialPlan = plan;
      } else if (plan !== initialPlan) {
        onActivated?.();
        return;
      }
    } catch {
      // ignore auth / network errors — just keep polling
    }

    if (Date.now() - startedAt >= MAX_WAIT_MS) {
      onTimeout?.();
      return;
    }

    timer = setTimeout(poll, POLL_INTERVAL_MS);
  }

  poll();
}
