import { ReactNode } from 'react';
import './globals.css';
import Header from '@/components/app_layout/Header';
import Footer from '@/components/app_layout/Footer';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface RootLayoutProps {
  children: ReactNode;
}

export const metadata = {
  title: "Decision support system",
  description: "For water management to analyze basin water dynamics through hydrological models, scenario generation, forecasting and data analytics, Integrate ground water and hydrological models to create river management plans.",
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen antialiased">
          <Header/>
          <main className="flex-1 flex flex-col w-full">
            {children}
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              className="mt-16 sm:mt-20" // Account for header height on mobile
              toastClassName="text-sm sm:text-base" // Responsive text size
            />
          </main>
          <Footer/>
      </body>
    </html>
  );
}