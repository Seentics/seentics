/** A full page load elsewhere (another origin, such as the auth app), in place of this page. */
export function hardRedirect(url: string): void {
  window.location.replace(url);
}
