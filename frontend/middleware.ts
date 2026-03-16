import { NextRequest, NextResponse } from 'next/server';

const protectedPrefixes = ['/dashboard'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('access_token')?.value;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !accessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/login' && accessToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login']
};
