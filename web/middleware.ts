import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const isEnterprise = process.env.NEXT_PUBLIC_IS_ENTERPRISE === 'true';

const publicOnlyRoutes = ['/signin', '/forgot-password', '/reset-password'];

/**
 * Real verification of the `access_token` cookie gateway now sets on login
 * (see gateway/routes/auth.ts `setAuthCookies`) — the same HS256/JWT_SECRET
 * contract every backend in the suite verifies against. Replaces the old
 * `auth-storage` cookie check, which decoded JSON that nothing ever actually
 * wrote and could be forged by any client since it wasn't a signature at all.
 */
async function isAuthenticatedRequest(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return false;
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    return payload.typ === 'access' && typeof payload.user_id === 'string';
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
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

  const isAuthenticated = await isAuthenticatedRequest(request);

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

  // NOTE: This middleware still does not block protected dashboard routes —
  // that's a scope choice now, not a technical limitation. `isAuthenticatedRequest`
  // above is a real signature check and could gate any route; enforcing that
  // suite-wide needs an explicit public/protected route map this pass doesn't
  // have, so client-side guards (api.ts interceptors, page-level redirects)
  // remain the enforcement mechanism for now.

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