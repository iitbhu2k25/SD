//  // frontend/app/dss/visualizations/vector/components/Compass.tsx
// Compass display component

import React from 'react';

interface CompassProps {
  visible: boolean;
}

export default function Compass({ visible }: CompassProps) {
  if (!visible) return null;

  return (
    <div 
      id="compass" 
      className="absolute top-10 left-10 w-24 h-24 pointer-events-auto"
    >
      <img 
        src="/compas.png" 
        alt="Compass" 
        className="w-full h-full object-contain drop-shadow-md" 
      />
    </div>
  );
}