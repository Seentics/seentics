import { getApiUrl } from '@/lib/config';

/**
 * Where the visitor is, from the gateway's GET /billing/region (Cloudflare's country for the
 * request): Bangladesh gets Bangla by default and pays in taka with bKash, Nagad or Rocket.
 * `manualPayments` is null outside Bangladesh, or when no payment number is configured.
 */
export type ManualPaymentMethodId = 'bkash' | 'nagad' | 'rocket';

export type ManualPaymentMethod = {
  id: ManualPaymentMethodId;
  name: string;
  /** The number customers send money to, e.g. 01XXXXXXXXX. */
  number: string;
  /** A personal number takes Send Money, a merchant number Payment, an agent number Cash Out. */
  kind: 'personal' | 'merchant' | 'agent';
};

export type Region = {
  country: string | null;
  region: 'bd' | 'global';
  manualPayments: { accountName: string | null; methods: ManualPaymentMethod[] } | null;
};

const CACHE_KEY = 'seentics_region';
const GLOBAL: Region = { country: null, region: 'global', manualPayments: null };

let pending: Promise<Region> | null = null;

/**
 * The visitor's region, asked once a browser session: it is cached in sessionStorage, and
 * concurrent callers share one request. An error answers `global`, and is not cached.
 */
export function fetchRegion(): Promise<Region> {
  if (typeof window === 'undefined') return Promise.resolve(GLOBAL);
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) return Promise.resolve(JSON.parse(cached) as Region);
  } catch {
    // storage blocked: ask the gateway
  }
  pending ??= fetch(getApiUrl('/billing/region'), { credentials: 'omit' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`region: HTTP ${res.status}`);
      const region = ((await res.json()) as { data?: Region }).data ?? GLOBAL;
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(region));
      } catch {
        // not cached: asked again next page load
      }
      return region;
    })
    .catch(() => GLOBAL)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Whether taka payments are open to this visitor: in Bangladesh, with a number to pay to. */
export const offersManualPayments = (region: Region | null | undefined): boolean =>
  region?.region === 'bd' && !!region.manualPayments?.methods.length;
