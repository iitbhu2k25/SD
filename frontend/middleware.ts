'use server';
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { api } from "@/services/api";
import { jwtVerify } from 'jose';

const SECRET = process.env.NEXT_PUBLIC_SECRET;
const protectedRoutes = ["/dss", "/profile", "/dashboard"]; // Add more as needed

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static/image/API routes
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const token = request.cookies.get("refresh_token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    console.log("token verification started");
    await jwtVerify(token, new TextEncoder().encode(SECRET));
    console.log("token verified successfully");
    return NextResponse.next();
  } catch (err) {
    console.log("Error verifying token:", err);

    try {
      const backendRes = await api.get("/authentication/authentic");

      if (backendRes.status === 201) {
        console.log("Token is valid on backend, proceeding...");
        return NextResponse.next();
      } else {
        console.log("Token is invalid on backend, redirecting...");
        return NextResponse.redirect(new URL("/", request.url));
      }
    } catch (backendErr) {
      console.log("Backend check failed:", backendErr);
      return NextResponse.redirect(new URL("/", request.url));
    }
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
