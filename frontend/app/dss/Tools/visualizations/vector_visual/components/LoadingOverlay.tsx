//  // frontend/app/dss/visualizations/vector/components/LoadingOverlay.tsx
// Loading overlay component

import React from 'react';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export default function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-white/60 backdrop-blur-sm">
      <div className="bg-white/95 py-3 px-4 rounded-lg shadow-md flex items-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span className="text-sm">{message || 'Loading...'}</span>
      </div>
    </div>
  );
}
