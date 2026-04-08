/**
 * Fixes common website URL typos so in-app previews (heatmaps iframe) match the dev dashboard origin.
 * Example: user sets "https://localhost.com" but runs the app at http://localhost:3000 → broken iframe / chrome-error.
 */
export function normalizeWebsiteOriginForPreview(
  rawUrl: string,
  browserOrigin: string | undefined,
): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  let withProto = trimmed;
  if (!/^https?:\/\//i.test(withProto)) withProto = `https://${withProto}`;
  let url: URL;
  try {
    url = new URL(withProto);
  } catch {
    return trimmed.replace(/\/$/, '');
  }
  if (!browserOrigin) {
    return `${url.protocol}//${url.host}`.replace(/\/$/, '');
  }
  let app: URL;
  try {
    app = new URL(browserOrigin);
  } catch {
    return `${url.protocol}//${url.host}`.replace(/\/$/, '');
  }
  const appHost = app.hostname.toLowerCase();
  const isLocalDashboard = appHost === 'localhost' || appHost === '127.0.0.1';
  const bogusLocalHostnames = new Set(['localhost.com', 'www.localhost.com']);
  if (isLocalDashboard && bogusLocalHostnames.has(url.hostname.toLowerCase())) {
    url.protocol = app.protocol;
    url.hostname = app.hostname;
    url.port = app.port;
  }
  return `${url.protocol}//${url.host}`.replace(/\/$/, '');
}
