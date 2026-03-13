"use client";

import { ReactNode, Suspense } from "react";
import { ToastContainer } from "react-toastify";
import AuthToastListener from "@/components/AuthToastListener";

export default function ClientWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <AuthToastListener />
      </Suspense>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        className="mt-16 sm:mt-20"
        toastClassName="text-sm sm:text-base"
      />
      {children}
    </>
  );
}