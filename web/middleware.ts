import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define protected routes
const protectedRoutes = [
  '/websites',
  '/dashboard',
  '/analytics',
  '/workflows',
  '/settings',
  '/profile',
];

// Define public routes that don't require authentication
const publicRoutes = [
  '/',
  '/signin',
  '/signup',
  '/setup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

const isEnterprise = process.env.NEXT_PUBLIC_IS_ENTERPRISE === 'true';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // OSS mode: redirect enterprise-only public routes
  if (!isEnterprise) {
    if (pathname === '/signup' || pathname.startsWith('/signup')) {
      return NextResponse.redirect(new URL('/setup', request.url));
    }
    if (pathname === '/pricing' || pathname.startsWith('/pricing')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Check if the path is protected
  const isProtectedRoute = protectedRoutes.some(route =>
    pathname.startsWith(route)
  );

  // Check if the path is public
  const isPublicRoute = publicRoutes.some(route =>
    pathname === route || pathname.startsWith(route)
  );

  // Get auth token from cookies
  const authToken = request.cookies.get('auth-storage')?.value;

  // Parse the auth storage to check if user is authenticated
  let isAuthenticated = false;
  if (authToken) {
    try {
      const authData = JSON.parse(authToken);
      isAuthenticated = authData.state?.isAuthenticated || false;
    } catch (error) {
      console.error('Error parsing auth storage:', error);
    }
  }

  // If it's a protected route and user is not authenticated, redirect to login
  if (isProtectedRoute && !isAuthenticated) {
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // If user is authenticated and trying to access signin, redirect to dashboard
  if (isAuthenticated && pathname === '/signin') {
    return NextResponse.redirect(new URL('/websites', request.url));
  }

  // If user is authenticated and trying to access signup, redirect to dashboard
  if (isAuthenticated && pathname === '/signup') {
    return NextResponse.redirect(new URL('/websites', request.url));
  }

  // Continue with the request
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}; 