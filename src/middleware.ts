import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths that are excluded from auth checks
  const isExcluded = 
    pathname.startsWith("/_next") || 
    pathname.startsWith("/api") || 
    pathname.startsWith("/favicon.ico") || 
    pathname.startsWith("/proofs") || // screenshot proofs folder
    pathname === "/login";

  const session = request.cookies.get("auth_session")?.value;

  if (!session && !isExcluded) {
    // Redirect to login if not verified
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (session && pathname === "/login") {
    // Redirect verified user away from login to home
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

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
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
