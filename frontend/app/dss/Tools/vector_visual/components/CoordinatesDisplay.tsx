import React from 'react';
import { Coordinates } from '../types/map.types';

interface CoordinatesDisplayProps {
  coordinates: Coordinates;
}

export default function CoordinatesDisplay({ coordinates }: CoordinatesDisplayProps) {
  return (
    <div
      className="pointer-events-none"
      style={{
        position: 'absolute',
        bottom: 28,        /* sits just above the Leaflet scale bar (~18px tall) */
        left: 8,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(0,0,0,0.22)',
        borderRadius: 3,
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        padding: '2px 7px',
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#333',
        letterSpacing: 0.2,
        whiteSpace: 'nowrap',
      }}
    >
      {coordinates.lat.toFixed(5)}&nbsp;&nbsp;{coordinates.lng.toFixed(5)}
    </div>
  );
}
