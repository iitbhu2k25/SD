"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import GridSection from '@/app/dss/home/home_grid/GridSection';
import StepCardsGrid from '@/app/dss/home/cards/StepCards.Grid';
import HLSVideoPlayer from '@/components/HlsPlayer';
import HomeHeader from '@/app/dss/home/home_header/home_header';

const AUTH_MESSAGES: Record<string, string> = {
  auth_required: "Please login or create an account to continue",
  not_verified: "Your account is pending admin approval",
  session_expired: "Your session expired. Please login again",
  forbidden: "You are not authorized to access this page",
};

function AuthErrorHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const reason = searchParams.get("auth_error");
    if (!reason) return;

    const message = AUTH_MESSAGES[reason];
    if (!message) return;

    toast.error(message, { toastId: "auth-error" });

    const url = new URL(window.location.href);
    url.searchParams.delete("auth_error");
    window.history.replaceState({}, "", url.pathname);
  }, [searchParams]);

  return null;
}

export default function Home() {
  return (
    <div>
      <Suspense>
        <AuthErrorHandler />
      </Suspense>
      <HomeHeader />
      <GridSection />
      <StepCardsGrid />
      <div
        className="w-full mx-auto"
        style={{
          backgroundImage: 'url("/Images/main_page.jpeg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <HLSVideoPlayer
          src="/Videos/master.m3u8"
        />
      </div>
    </div>);
}
