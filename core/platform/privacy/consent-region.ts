/**
 * Where a visitor's consent is needed before they are recorded or identified.
 *
 * The EU and the rest of the EEA (GDPR and the ePrivacy Directive), the UK (UK GDPR and
 * PECR) and Switzerland (revFADP). Elsewhere a site on the default `cookieless` mode
 * records and identifies visitors without a consent banner; the site's privacy policy is
 * its notice. A visitor whose country is not known is treated as needing consent — the
 * answer that cannot be wrong.
 */
const CONSENT_COUNTRIES = new Set([
  // EU
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // EEA outside the EU
  'IS', 'LI', 'NO',
  // UK and Switzerland
  'GB', 'CH',
  // EU territory with its own code: the Åland Islands, French overseas regions
  'AX', 'GF', 'GP', 'MQ', 'RE', 'YT', 'MF',
]);

export function requiresConsent(country: string | null | undefined): boolean {
  if (!country) return true;
  return CONSENT_COUNTRIES.has(country.trim().toUpperCase());
}
