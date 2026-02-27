'use client';
import React from 'react';
import dynamic from 'next/dynamic';

// Dynamic import for the WatershedApp component with no SSR
// This is necessary because Leaflet requires browser APIs and won't work with server-side rendering
const WatershedApp = dynamic(
  () => import('./components/WatershedApp'),
  { ssr: false }
);

export default function WatershedPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <WatershedApp />
    </div>
  );
}