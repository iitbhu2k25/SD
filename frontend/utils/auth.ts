// utils/auth.ts
import { validateToken } from "./jwt";

// Route constants
export const AUTH_ROUTES = {
  LOGIN: "/authentication",
  SIGNUP: "/authentication",
  FORGOT_PASSWORD: "/authentication/forgot-password",
  VERIFY_OTP: "/authentication/verify-otp",
  RESET_PASSWORD: "/authentication/reset-password",
  SEND_OTP: "/authentication/send-otp",
  VERIFY_EMAIL: "/authentication/verify-email",
} as const;

export const PROTECTED_ROUTES = {
  HOME: "/dss",
  DASHBOARD: "/dashboard",
  PROFILE: "/profile",
} as const;

// Determine redirect path based on auth state
export const getRedirectPath = (authenticated: boolean): string => {
  return authenticated ? PROTECTED_ROUTES.HOME : AUTH_ROUTES.LOGIN;
};

// Client-side auth check using JWT validation (no server calls)
export const checkAuthState = async () => {
  try {
    const { isValid, user } = await validateToken();

    return {
      isAuthenticated: isValid,
      user: user, // { fullname: string; email: string }
      redirectTo: getRedirectPath(isValid),
    };
  } catch (error) {
    console.log("Client-side auth check failed:", error);
    return {
      isAuthenticated: false,
      user: null,
      redirectTo: AUTH_ROUTES.LOGIN,
    };
  }
};

// Route type helpers
export type AuthRoute = (typeof AUTH_ROUTES)[keyof typeof AUTH_ROUTES];
export type ProtectedRoute =
  (typeof PROTECTED_ROUTES)[keyof typeof PROTECTED_ROUTES];

// Check if a route is protected
export const isProtectedRoute = (pathname: string): boolean => {
  return Object.values(PROTECTED_ROUTES).some((route) =>
    pathname.startsWith(route)
  );
};

// Check if a route is public/auth route
export const isAuthRoute = (pathname: string): boolean => {
  return Object.values(AUTH_ROUTES).some((route) => pathname.startsWith(route));
};

// Get the appropriate redirect URL with return parameter
export const getLoginRedirectUrl = (returnUrl?: string): string => {
  const loginUrl = new URL(AUTH_ROUTES.LOGIN, window.location.origin);

  if (returnUrl && returnUrl !== "/" && returnUrl !== AUTH_ROUTES.LOGIN) {
    loginUrl.searchParams.set("returnUrl", returnUrl);
  }

  return loginUrl.toString();
};

// Route guard for components (can be used in useEffect)
export const useRouteGuard = async () => {
  const checkAndRedirect = async (currentPath: string) => {
    const authState = await checkAuthState();
    const { isAuthenticated } = authState;

    // If user is not authenticated and trying to access protected route
    if (!isAuthenticated && isProtectedRoute(currentPath)) {
      window.location.href = getLoginRedirectUrl(currentPath);
      return false;
    }

    // If user is authenticated and trying to access auth routes
    if (isAuthenticated && isAuthRoute(currentPath)) {
      window.location.href = PROTECTED_ROUTES.HOME;
      return false;
    }

    return true;
  };

  return { checkAndRedirect };
};
