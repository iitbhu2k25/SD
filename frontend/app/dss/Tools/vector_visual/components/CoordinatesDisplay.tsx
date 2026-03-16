//  // frontend/app/dss/visualizations/vector/components/CoordinatesDisplay.tsx
// Coordinates display component

import React from 'react';
import { Coordinates } from '../types/map.types';

interface CoordinatesDisplayProps {
  coordinates: Coordinates;
}

export default function CoordinatesDisplay({ coordinates }: CoordinatesDisplayProps) {
  return (
    <div className="absolute bottom-1 left-28 bg-white/90 py-1 px-3 rounded-lg shadow-md backdrop-blur-sm text-sm pointer-events-auto">
      <span className="font-medium text-gray-700">
        Lat: {coordinates.lat} | Lng: {coordinates.lng}
      </span>
    </div>
  );
}