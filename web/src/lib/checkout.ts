/**
 * Opens a LemonSqueezy checkout URL in the embedded modal overlay.
 * Falls back to a full-page redirect if the SDK hasn't loaded yet.
 *
 * The caller should show its own loading state before calling this,
 * and hide it after this function returns (the modal is now open).
 */
export function openCheckout(rawUrl: string) {
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

  // Enable embedded modal
  if (!url.includes('embed=1')) {
    url += (url.includes('?') ? '&' : '?') + 'embed=1';
  }

  // After successful payment, redirect back into the app
  const successUrl = encodeURIComponent(
    typeof window !== 'undefined'
      ? `${window.location.origin}/websites`
      : 'https://seentics.com/websites'
  );
  if (!url.includes('checkout[success_url]')) {
    url += `&checkout[success_url]=${successUrl}`;
  }

  // Try the modal, fall back to redirect
  if (typeof window !== 'undefined' && window.LemonSqueezy) {
    window.LemonSqueezy.Url.Open(url);
  } else {
    window.location.href = url;
  }
}
