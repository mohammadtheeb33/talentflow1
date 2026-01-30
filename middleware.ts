import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// NOTE: The user requested "next-auth/middleware", but "next-auth" is not installed in this project.
// We are implementing the EXACT SAME strict separation logic using the existing "auth_token" cookie mechanism.

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. EXPLICITLY ALLOW Outlook Callback (Prevent Redirect Loop)
  if (pathname.startsWith('/api/integrations/outlook/callback')) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/admin/login')) {
    return NextResponse.next();
  }
  
  // 1. Define Admin/Protected Routes
  // These are the routes that were moved to app/(admin)
  const adminRoutes = [
    '/admin',
    '/dashboard', 
    '/cvs', 
    '/candidates', // user mentioned this, linking to cvs likely
    '/job-profiles', 
    '/jobs',      // user mentioned this
    '/reports', 
    '/calendar', 
    '/settings', 
    '/upload'
  ];

  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));
  
  // Check for auth token (existing mechanism)
  const token = request.cookies.get('auth_token')?.value;

  // 2. Strict Logic: If accessing Admin routes without login -> Redirect to Login
  if (isAdminRoute && !token) {
    // Moved login from /auth/login to /login (in app/(public)/login)
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. If accessing Public routes (Careers, Login) -> ALLOW everyone
  // (Implicitly allowed by falling through)
  
  // Optional: Redirect authenticated users away from login page
  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (pathname === '/admin/login' && token) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Exclude public assets, api/public, and static files from auth middleware
  matcher: [
    '/((?!api/public|api/integrations/outlook/callback|careers|_next/static|_next/image|favicon.ico).*)',
  ],
};
