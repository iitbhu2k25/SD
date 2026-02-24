"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-toastify";

const AUTH_MESSAGES: Record<string, string> = {
  auth_required: "Please login or create an account to continue",
  session_expired: "Your session expired. Please login again",
  forbidden: "You are not authorized to access this page",
};

export default function AuthToastListener() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const reason = searchParams.get("auth_error");

    if (!reason) {
      
      return;
    }

    const message = AUTH_MESSAGES[reason];
    
    if (!message) {
      console.log("❌ No message for reason:", reason);
      return;
    }

    console.log("✅ Showing toast:", message);

    toast.error(message, {
      toastId: "auth-error",
    });

    // Clean URL using Next.js router
    const url = new URL(window.location.href);
    url.searchParams.delete("auth_error");
    window.history.replaceState({}, "", url.pathname);
    
  }, [searchParams]);

  return null;
}