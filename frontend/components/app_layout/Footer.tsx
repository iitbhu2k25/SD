'use client';
import Image from 'next/image';
import React from 'react';

export default function Footer() {
  const partnerLogos = [
    { src: "/Images/footer/logo2.svg", alt: "Jal shakti", link: "https://www.jalshakti-dowr.gov.in/" },
    { src: "/Images/footer/logo1.png", alt: "Denmark", link: "https://um.dk/en" },
    { src: "/Images/footer/logo3.gif", alt: "Company Seal", unoptimized: true, link: "https://nmcg.nic.in/" },
    { src: "/Images/footer/iitbhu.png", alt: "IIT BHU", link: "https://iitbhu.ac.in/" },
    { src: "/Images/footer/iitbombay.png", alt: "IIT Bombay", link: "https://www.iitb.ac.in/" },
    { src: "/Images/footer/iit_delhi_logo.png", alt: "IIT Delhi", link: "https://home.iitd.ac.in/" },
    { src: "/Images/footer/IIT_Madras_Logo.svg.png", alt: "IIT Madras", link: "https://www.iitm.ac.in/" },
    { src: "/Images/footer/japan.svg", alt: "Japan", link: "https://www.global.hokudai.ac.jp/" },
  ];

  return (
    <footer className="w-full mt-auto">
      {/* Partner logos section */}
      <div className="bg-gray-100 text-gray-800 py-2 sm:py-6 lg:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center">
            {partnerLogos.map((logo, index) => (
              <a
                key={index}
                href={logo.link}
                target="_blank"
                rel="noopener noreferrer"
                className="relative w-16 h-10 sm:w-20 sm:h-12 md:w-24 md:h-14 lg:w-28 lg:h-16 xl:w-32 xl:h-18 hover:opacity-80 transition-opacity duration-200"
              >
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  fill
                  sizes="(max-width: 640px) 64px, (max-width: 768px) 80px, (max-width: 1024px) 96px, (max-width: 1280px) 112px, 128px"
                  style={{ objectFit: 'contain', padding: '4px' }}
                  unoptimized={logo.unoptimized || false}
                  className="rounded-md"
                />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Copyright and footer info */}
      <div className="bg-[#000066] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main footer content */}

          {/* Bottom copyright bar */}
          <div className="border-t border-white/20 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
              <div className="text-center sm:text-left">
                <p className="text-sm sm:text-base font-medium">
                  © {new Date().getFullYear()} Decision Support System for Water Resource Management
                </p>
                <p className="text-xs sm:text-sm text-white/70 mt-1">
                  IIT BHU, Varanasi. All Rights Reserved.
                </p>
              </div>

              <div className="flex flex-wrap justify-center sm:justify-end space-x-4 sm:space-x-6 text-xs sm:text-sm">
                <a href="#" className="text-white/70 hover:text-white transition-colors duration-200">
                  Privacy Policy
                </a>
                <a href="#" className="text-white/70 hover:text-white transition-colors duration-200">
                  Terms of Use
                </a>
                <a href="#" className="text-white/70 hover:text-white transition-colors duration-200">
                  Accessibility
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}