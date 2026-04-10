"use client";

import { ReactNode } from "react";
import { Toaster } from "react-hot-toast";

export default function ClientWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <Toaster
        position="top-right"
        gutter={8}
        containerStyle={{ top: 120 }}
        toastOptions={{
          duration: 4500,
          style: {
            borderRadius: "8px",
            fontSize: "0.875rem",
            maxWidth: "380px",
            padding: "12px 16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          },
          success: {
            duration: 3000,
            iconTheme: { primary: "#16a34a", secondary: "#fff" },
            style: {
              background: "#f0fdf4",
              color: "#15803d",
              border: "1px solid #bbf7d0",
            },
          },
          error: {
            duration: 5000,
            iconTheme: { primary: "#dc2626", secondary: "#fff" },
            style: {
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
            },
          },
          loading: {
            style: {
              background: "#eff6ff",
              color: "#1d4ed8",
              border: "1px solid #bfdbfe",
            },
          },
        }}
      />
      {children}
    </>
  );
}
