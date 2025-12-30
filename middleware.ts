import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Define protected and public routes
  const isProtectedRoute = 
    pathname.startsWith('/dashboard') || 
    pathname.startsWith('/cvs') || 
    pathname.startsWith('/job-profiles') || 
    pathname.startsWith('/settings') || 
    pathname.startsWith('/reports') || 
    pathname.startsWith('/upload');
    
  const isAuthRoute = pathname.startsWith('/auth');
  const isRoot = pathname === '/';

  // Check for auth token in cookies
  const token = request.cookies.get('auth_token')?.value;

  // 1. Redirect unauthenticated users to login
  if (isProtectedRoute && !token) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // 2. Redirect authenticated users away from login
  if ((isAuthRoute || isRoot) && token) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  
  // 3. Handle root redirect if no token
  if (isRoot && !token) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Correctly ignore all static files, images, and API routes
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
};
