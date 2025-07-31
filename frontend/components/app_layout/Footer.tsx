'use client';
import Image from 'next/image';
import React from 'react';

export default function Footer() {
  return (
    <footer className="w-full mt-auto">
      {/* Partner logos section */}
      <div className="bg-gray-100 text-gray-800 py-6">
        <div className="max-w-8xl mx-auto px-4">
          <div className="flex justify-center flex-wrap gap-2 sm:gap-8">
            {[
              { src: "/Images/footer/logo1.png", alt: "Partner Logo" },
              { src: "/Images/footer/logo2.svg", alt: "Trusted Brand" },
              { src: "/Images/footer/logo3.gif", alt: "Company Seal", unoptimized: true },
              { src: "/Images/footer/iitbhu.png", alt: "IIT BHU" },
              { src: "/Images/footer/iitbombay.png", alt: "IIT Bombay" },
              { src: "/Images/footer/download.png", alt: "Additional Partner" },
              { src: "/Images/footer/iit_delhi_logo.png", alt: "IIT Delhi" },
              { src: "/Images/footer/IIT_Madras_Logo.svg.png", alt: "IIT Madras" },
              { src: "/Images/footer/50.png", alt: "Anniversary Logo" },
            ].map((logo, index) => (
              <div key={index} className="relative w-28 h-14 sm:w-32 sm:h-16">
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  fill
                  sizes="100%"
                  style={{ objectFit: 'contain' }}
                  unoptimized={logo.unoptimized || false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="bg-[#000066] text-white text-center text-sm py-3 px-4">
        <p className="mb-1">© {new Date().getFullYear()} Decision Support System for Water Resource Management</p>
        <p className="text-white/70">IIT BHU. All Rights Reserved.</p>
      </div>
    </footer>
  );
}
