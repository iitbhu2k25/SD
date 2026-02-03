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
    <html lang="en">
      <body className="flex flex-col min-h-screen antialiased">
        <ClientWrapper>
          <Header />
          <Navbar />

          <main className="flex-1 flex flex-col w-full">
            {children}
          </main>

          <Footer />
        </ClientWrapper>
      </body>
    </html>
  );
}