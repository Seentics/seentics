/**
 * Agency workspace demo mode.
 *
 * The website dashboard's demo lives at `/websites/demo` (the website id is the switch). The
 * agency workspace has no id in its URL, so its demo is switched on with `?demo=1` on any
 * `/agency` page and kept for the browser session (sessionStorage), so moving between the
 * workspace's pages keeps it. `?demo=0` (the "Exit demo" link) switches it off.
 *
 * While it is on, every `features/agency/api.ts` call answers from `./agency` fixtures (no network),
 * the plan gate lets the visitor in without asking for entitlements, and every write is refused
 * with the website demo's own toast (`demoMutationGuard`).
 */

import { useEffect, useState } from 'react';
import { DEMO_WEBSITE_ID, demoMutationGuard } from './index';

export const AGENCY_DEMO_STORAGE_KEY = 'seentics.agency-demo';

/** Where "Exit demo" goes: the workspace with the demo switched off. */
export const AGENCY_DEMO_EXIT_HREF = '/agency?demo=0';

const onAgencyPath = () => /^\/agency(\/|$)/.test(window.location.pathname);

/**
 * Whether the agency demo is on, read now. `?demo=1` / `?demo=0` in the address switch it (and
 * are remembered for the session); otherwise the session decides. Only ever true on `/agency`
 * pages, and never on the server (so call it after mount, or through `useAgencyDemo`).
 */
export function isAgencyDemo(): boolean {
  if (typeof window === 'undefined' || !onAgencyPath()) return false;
  const param = new URLSearchParams(window.location.search).get('demo');
  try {
    if (param === '1' || param === 'true') {
      window.sessionStorage.setItem(AGENCY_DEMO_STORAGE_KEY, '1');
      return true;
    }
    if (param === '0' || param === 'false') {
      window.sessionStorage.removeItem(AGENCY_DEMO_STORAGE_KEY);
      return false;
    }
    return window.sessionStorage.getItem(AGENCY_DEMO_STORAGE_KEY) === '1';
  } catch {
    // Storage blocked (private window, sandboxed frame): the address alone decides.
    return param === '1' || param === 'true';
  }
}

/** Switches the agency demo off for this session. */
export function exitAgencyDemo(): void {
  try {
    window.sessionStorage.removeItem(AGENCY_DEMO_STORAGE_KEY);
  } catch {
    /* nothing remembered */
  }
}

/**
 * The demo switch for components rendered in the static HTML: `null` until mounted (the server
 * cannot read the session), then whether the demo is on. Rendering nothing workspace-specific
 * while it is `null` keeps the first client render equal to the static HTML and stops any real
 * request from going out before the demo is known.
 */
export function useAgencyDemo(): boolean | null {
  const [demo, setDemo] = useState<boolean | null>(null);
  useEffect(() => setDemo(isAgencyDemo()), []);
  return demo;
}

/**
 * Guard for agency writes: in the demo, shows the website demo's toast and answers true (skip
 * the write). The same toast as `demoMutationGuard`, because it is that function.
 */
export function agencyDemoGuard(): boolean {
  if (!isAgencyDemo()) return false;
  return demoMutationGuard(DEMO_WEBSITE_ID);
}

/** Thrown by an agency write that reached the API layer during the demo. */
export class AgencyDemoRefusal extends Error {
  constructor() {
    super('Changes are not saved in demo mode.');
    this.name = 'AgencyDemoRefusal';
  }
}

/**
 * A website's dashboard. In the demo every agency site opens the website demo, which has data
 * and needs no sign-in; outside it, the site itself.
 */
export function agencySiteHref(websiteId: string): string {
  return `/websites/${isAgencyDemo() ? DEMO_WEBSITE_ID : websiteId}`;
}
