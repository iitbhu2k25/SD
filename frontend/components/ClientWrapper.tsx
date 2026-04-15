"use client";

import { ReactNode } from "react";
import { ToastContainer } from "react-toastify";

export default function ClientWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={2500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        style={{ top: 100 }}
      />
      {children}
    </>
  );
}
