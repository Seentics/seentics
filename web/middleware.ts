import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isEnterprise = process.env.NEXT_PUBLIC_IS_ENTERPRISE === 'true';

const publicOnlyRoutes = ['/signin', '/forgot-password', '/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Tracker hits `/api/v1/tracker/*` via rewrite to the gateway → core. The TCP peer there is localhost,
  // so the core must see the browser via X-Forwarded-For. Next may expose `request.ip` (e.g. on Vercel / some hosts).
  if (pathname.startsWith('/api/v1/tracker')) {
    const h = new Headers(request.headers);
    if (!h.get('x-forwarded-for')?.trim()) {
      const reqWithIp = request as NextRequest & { ip?: string | null };
      const ip = typeof reqWithIp.ip === 'string' ? reqWithIp.ip.trim() : '';
      if (ip) {
        h.set('x-forwarded-for', ip);
      }
    }
    return NextResponse.next({ request: { headers: h } });
  }

  // OSS mode: redirect enterprise-only public routes
  if (!isEnterprise) {
    if (pathname === '/signup' || pathname.startsWith('/signup')) {
      return NextResponse.redirect(new URL('/setup', request.url));
    }
    if (pathname === '/pricing' || pathname.startsWith('/pricing')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Try to read auth state from cookie (written by AuthInitializer.tsx)
  const authToken = request.cookies.get('auth-storage')?.value;
  let isAuthenticated = false;

  if (authToken) {
    try {
      const decodedToken = decodeURIComponent(authToken);
      const authData = JSON.parse(decodedToken);
      isAuthenticated = authData.state?.isAuthenticated === true;
    } catch {
      // Invalid cookie — treat as not authenticated
    }
  }

  // If user is confirmed authenticated and tries to access signin/forgot-password etc., redirect to dashboard
  if (isAuthenticated) {
    const isPublicOnlyRoute = publicOnlyRoutes.some(
      route => pathname === route || pathname.startsWith(route)
    );
    if (isPublicOnlyRoute) {
      return NextResponse.redirect(new URL('/websites', request.url));
    }

    // Also redirect from bare /signup to /websites (if confirmed authenticated)
    if (pathname === '/signup' && !request.nextUrl.searchParams.has('step')) {
      return NextResponse.redirect(new URL('/websites', request.url));
    }
  }

  // NOTE: We do NOT block protected routes server-side because auth is stored in
  // localStorage (Zustand persist), which is not accessible in middleware.
  // Client-side auth guards (api.ts interceptors, page-level redirects) handle
  // unauthorized access to protected pages.

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/v1/tracker',
    '/api/v1/tracker/:path*',
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - trackers (public tracker JS files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public|trackers).*)',
  ],
};