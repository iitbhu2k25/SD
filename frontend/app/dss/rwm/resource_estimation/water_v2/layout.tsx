"use client";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function WaterV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden" style={{ height: "calc(100vh - 8rem)" }}>
      {children}
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        theme="light"
        style={{ zIndex: 9999 }}
      />
    </div>
  );
}
