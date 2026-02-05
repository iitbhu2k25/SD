import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_NAMESPACE = "/dss";

const PUBLIC_DSS_ROUTES = [
  "/dss/about/product",
  "/dss/about/team",
  "/dss/help",
  "/dss/dashboard",
  "/dss/activities/gallery",
  "/dss/contact",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (!pathname.startsWith(PROTECTED_NAMESPACE)) {
    return NextResponse.next();
  }

  if (PUBLIC_DSS_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get("verified_token")?.value;

 if (!refreshToken) {
  const url = new URL("/", request.url);
  url.searchParams.set("auth_error", "auth_required");
  
  return NextResponse.redirect(url);
}

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
