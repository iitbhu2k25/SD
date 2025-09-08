'use client';

import { useState } from 'react';
import LightGallery from 'lightgallery/react';
import lgZoom from 'lightgallery/plugins/zoom';
import Image from 'next/image';

// ✅ LightGallery core & plugin styles (must import)
import 'lightgallery/css/lightgallery.css';
import 'lightgallery/css/lg-zoom.css';

const galleryImages = [
  '/Images/gallery/g1.jpg',
  '/Images/gallery/g2.webp',
  '/Images/gallery/g3.webp',
  '/Images/gallery/g4.webp',
  '/Images/gallery/g5.webp',
  '/Images/gallery/g6.webp',
  '/Images/gallery/g7.webp',
  '/Images/gallery/g8.webp',
  '/Images/gallery/g9.webp',
  '/Images/gallery/g10.webp',
];

export default function gallery() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-slate-50">
     

      <div className="max-w-6xl mx-auto px-6 py-12">
        <LightGallery
          plugins={[lgZoom]}
          speed={500}
          elementClassNames="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
        >
          {galleryImages.map((src, index) => (
            <a
              key={index}
              href={src} // ✅ LightGallery requires `href` or `data-src`
              className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Image
                src={src}
                alt={`Gallery ${index + 1}`}
                width={500}
                height={500}
                className="w-full h-60 object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-semibold">
                Click to Zoom
              </div>
            </a>
          ))}
        </LightGallery>
      </div>
    </div>
  );
};
