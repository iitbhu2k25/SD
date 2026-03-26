import { ReactNode } from "react";
import "./globals.css";

import Header from "@/components/app_layout/Header";
import Footer from "@/components/app_layout/Footer";
import Navbar from "@/components/app_layout/Navbar";
import ClientWrapper from "@/components/ClientWrapper";

import "react-toastify/dist/ReactToastify.css";

interface RootLayoutProps {
  children: ReactNode;
}

export const metadata = {
  title: "Decision support system",
  description:
    "For water management to analyze basin water dynamics through hydrological models, scenario generation, forecasting and data analytics.",
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
        <ClientWrapper>
          <div className="flex min-h-screen flex-col">
            <div className="shrink-0">
              <Header />
            </div>
            <div className="shrink-0">
              <Navbar />
            </div>

            <main className="flex w-full flex-1 flex-col">
              {children}
            </main>

            <div className="shrink-0">
              <Footer />
            </div>
          </div>
        </ClientWrapper>
      </body>
    </html>
  );
}
