// Cloudflare Pages middleware — replaces middleware.ts, which static export
// can't ship at all (Middleware/Proxy is in Next's own "Unsupported
// Features" list for `output: 'export'`).
//
// The tracker IP-forwarding branch from the old middleware isn't ported:
// functions/api/v1/tracker/*.ts already forward the original request
// (cf-connecting-ip included, since Cloudflare sets that at the edge)
// untouched, so there's nothing left for this to add there. This only
// handles the auth/OSS-mode redirects, and skips /api/* entirely — those
// paths have their own Functions and don't need this logic or its JWT
// verify on every request.
//
// Before all that, a request to a host that is not ours is an agency's custom domain: see
// functions/lib/custom-host.ts. Nothing is served there until phase 3 (the full dashboard).

import { jwtVerify } from 'jose';
import { decideCustomHostRequest, isSeenticsHost } from './lib/custom-host';

interface Env {
  JWT_SECRET?: string;
  NEXT_PUBLIC_IS_ENTERPRISE?: string;
}

interface RequestContext {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}

const PUBLIC_ONLY_ROUTES = ['/signin', '/forgot-password', '/reset-password'];

function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('Cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

/**
 * Real verification of the `access_token` cookie gateway sets on login (see
 * gateway/routes/auth.ts `setAuthCookies`) — same HS256/JWT_SECRET contract
 * every backend in the suite verifies against.
 */
async function isAuthenticatedRequest(request: Request, secret: string | undefined): Promise<boolean> {
  const token = getCookie(request, 'access_token');
  if (!token || !secret) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    return payload.typ === 'access' && typeof payload.user_id === 'string';
  } catch {
    return false;
  }
}

export const onRequest = async (context: RequestContext): Promise<Response> => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const { pathname } = url;

  // An agency's custom domain: every path is a 404 until phase 3 serves the dashboard there.
  if (!isSeenticsHost(url.hostname) && decideCustomHostRequest(pathname) === 'not-found') {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
  }

  if (pathname.startsWith('/api')) return next();

  const isEnterprise = env.NEXT_PUBLIC_IS_ENTERPRISE === 'true';

  // OSS mode: redirect enterprise-only public routes
  if (!isEnterprise) {
    if (pathname === '/signup' || pathname.startsWith('/signup')) {
      return Response.redirect(new URL('/setup', url), 307);
    }
    if (pathname === '/pricing' || pathname.startsWith('/pricing')) {
      return Response.redirect(new URL('/', url), 307);
    }
  }

  const isAuthenticated = await isAuthenticatedRequest(request, env.JWT_SECRET);

  if (isAuthenticated) {
    const isPublicOnlyRoute = PUBLIC_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(route));
    // An agency's client sign-in (`/signin?agency=…`) and its email link (`/signin/verify`) must
    // open even with an account signed in in this browser: an agency trying its own invite would
    // otherwise be sent to /websites and the link never used.
    const isClientSignIn = pathname.startsWith('/signin/verify') || (pathname.startsWith('/signin') && url.searchParams.has('agency'));
    if (isPublicOnlyRoute && !isClientSignIn) {
      return Response.redirect(new URL('/websites', url), 307);
    }
    if (pathname === '/signup' && !url.searchParams.has('step')) {
      return Response.redirect(new URL('/websites', url), 307);
    }
  }

  // NOTE: same scope choice as the old middleware — this doesn't gate
  // protected dashboard routes. Client-side guards remain the enforcement
  // mechanism for now.

  return next();
};
