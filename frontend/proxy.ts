import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// All /dss pages are protected
const PROTECTED_NAMESPACE = "/dss";

// Explicit public pages under /dss
const PUBLIC_DSS_ROUTES = [
  "/dss/about",
  "/dss/help",
  "/dss/dashboard",
  "/dss/activities/gallery",
];

export  async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip next internals & assets
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Not under /dss → public
  if (!pathname.startsWith(PROTECTED_NAMESPACE)) {
    return NextResponse.next();
  }

  // Public exceptions inside /dss
  if (PUBLIC_DSS_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // 🔐 Protected page logic
  // We ONLY check presence of refresh token
  const refreshToken = request.cookies.get("refresh_token")?.value;

  if (!refreshToken) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Token exists → allow page render
  // Real validation happens in backend APIs
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
