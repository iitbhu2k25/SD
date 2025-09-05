'use client'
import Link from 'next/link';

export default function Header() {
  return (
    <header 
      className="w-full py-2 sm:py-3 lg:py-4 bg-gradient-to-r from-blue-50 to-blue-100 shadow-lg border-b border-blue-200 relative"
      style={{
        backgroundImage: "url('/Images/header/header_bg.gif')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-0">
          
          {/* Mobile Layout: Logo Row */}
          <div className="flex lg:hidden items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <Link href="https://www.india.gov.in/" className="transition-transform hover:scale-105">
                <img
                  src="/Images/header/left1_ashok.png"
                  alt="अशोक स्तंभ"
                  title="अशोक स्तंभ"
                  className="w-8 h-auto sm:w-12"
                />
              </Link>
              <Link href="https://iitbhu.ac.in/" className="transition-transform hover:scale-105">
                <img
                  src="/Images/header/left2_IIt_logo.png"
                  alt="IIT BHU"
                  title="IIT BHU"
                  className="w-16 h-auto sm:w-20"
                />
              </Link>
            </div>
            <div className="flex items-center space-x-2">
              <Link href="https://www.slcrvaranasi.com/" className="transition-transform hover:scale-105">
                <img
                  src="/Images/header/right1_slcr.png"
                  alt="Smart Laboratory on Clean River"
                  title="Smart Laboratory on Clean River"
                  className="w-16 h-auto sm:w-20"
                />
              </Link>
              <Link href="https://nmcg.nic.in/" className="transition-transform hover:scale-105">
                <img
                  src="/Images/header/right2_namami_ganga.gif"
                  alt="Namami Gange"
                  title="Namami Gange"
                  className="w-12 h-auto sm:w-16"
                />
              </Link>
            </div>
          </div>

          {/* Desktop Layout: Left Logos */}
          <div className="hidden lg:flex items-center space-x-4 xl:space-x-6 w-1/4">
            <Link href="https://www.india.gov.in/" className="transition-transform hover:scale-105">
              <img
                src="/Images/header/left1_ashok.png"
                alt="अशोक स्तंभ"
                title="अशोक स्तंभ"
                className="w-16 xl:w-20 h-auto"
              />
            </Link>
            <Link href="https://iitbhu.ac.in/" className="transition-transform hover:scale-105">
              <img
                src="/Images/header/left2_IIt_logo.png"
                alt="IIT BHU"
                title="IIT BHU"
                className="w-24 xl:w-32 h-auto transform scale-125 xl:scale-150 ml-4 xl:ml-6 transition-transform duration-300"
              />
            </Link>
          </div>

          {/* Center Section with Title and Running Tagline */}
          <div className="text-center w-full lg:w-1/2 px-2 lg:px-3">
            <h2 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-blue-800 tracking-wide mb-1">
              Decision Support System
            </h2>
            <div className="w-full overflow-hidden">
              <p className="text-xs sm:text-sm lg:text-base text-blue-600 font-medium whitespace-nowrap overflow-hidden relative">
                <span 
                  className="inline-block whitespace-nowrap"
                  style={{
                    animation: 'marquee 20s linear infinite',
                  }}
                >
                  Small Rivers Management Tool (SRMT) for Holistic Water Resources Management in India
                </span>
              </p>
            </div>
          </div>

          {/* Desktop Layout: Right Logos */}
          <div className="hidden lg:flex items-center justify-end space-x-4 xl:space-x-6 w-1/4">
            <Link href="https://www.slcrvaranasi.com/" className="transition-transform hover:scale-105">
              <img
                src="/Images/header/right1_slcr.png"
                alt="Smart Laboratory on Clean River"
                title="Smart Laboratory on Clean River"
                className="max-w-full h-auto w-32 xl:w-40"
              />
            </Link>
            <Link href="https://nmcg.nic.in/" className="transition-transform hover:scale-105">
              <img
                src="/Images/header/right2_namami_ganga.gif"
                alt="Namami Gange"
                title="Namami Gange"
                className="w-20 xl:w-26 h-auto"
              />
            </Link>
          </div>
        </div>
      </div>

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        
        @media (max-width: 1024px) {
          @keyframes marquee {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
        }
      `}</style>
    </header>
  );
}