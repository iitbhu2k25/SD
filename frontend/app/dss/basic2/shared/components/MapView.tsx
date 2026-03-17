'use client';

import { memo, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useBasicStore } from '../store/basic.store';
import { useMapSelection } from '../hooks/useMapSelection';

const AdminMap = dynamic(() => import('./AdminMapLayer'), { ssr: false });
const DrainMapView = dynamic(() => import('./DrainMapLayer'), { ssr: false });
const IndCatchMap = dynamic(() => import('./Indcatchmentmapview'), { ssr: false });

const StableAdminMap = memo(function StableAdminMap({
  selectedState, selectedDistricts, selectedSubDistricts, selectedVillages,
  onLocationSelect, className,
}: {
  selectedState?: string;
  selectedDistricts: string[];
  selectedSubDistricts: string[];
  selectedVillages: string[];
  onLocationSelect: (payload: any) => void;
  className?: string;
}) {
  return (
    <AdminMap
      selectedState={selectedState}
      selectedDistricts={selectedDistricts}
      selectedSubDistricts={selectedSubDistricts}
      selectedVillages={selectedVillages}
      onLocationSelect={onLocationSelect}
      className={className}
    />
  );
});

interface MapViewProps { className?: string; }

export default function MapView({ className }: MapViewProps) {
  const { mode } = useBasicStore();
  const { mapProps, handleMapLocationSelect } = useMapSelection();

  // Keep maps mounted after first visit so base map does not reload on mode switch.
  const [mountedModes, setMountedModes] = useState({
    admin: true,
    drain: false,
    india_catchment: false,
  });

  useEffect(() => {
    setMountedModes((prev) => (prev[mode] ? prev : { ...prev, [mode]: true }));
  }, [mode]);

  return (
    <div className={`relative h-full w-full ${className ?? ''}`}>
      {mountedModes.admin && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: mode === 'admin' ? 'visible' : 'hidden',
            pointerEvents: mode === 'admin' ? 'auto' : 'none',
          }}
        >
          <StableAdminMap
            selectedState={mapProps.selectedState}
            selectedDistricts={mapProps.selectedDistricts}
            selectedSubDistricts={mapProps.selectedSubDistricts}
            selectedVillages={mapProps.selectedVillages}
            onLocationSelect={handleMapLocationSelect}
            className="h-full w-full"
          />
        </div>
      )}

      {mountedModes.drain && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: mode === 'drain' ? 'visible' : 'hidden',
            pointerEvents: mode === 'drain' ? 'auto' : 'none',
          }}
        >
          <DrainMapView className="h-full w-full" />
        </div>
      )}

      {mountedModes.india_catchment && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: mode === 'india_catchment' ? 'visible' : 'hidden',
            pointerEvents: mode === 'india_catchment' ? 'auto' : 'none',
          }}
        >
          <IndCatchMap className="h-full w-full" />
        </div>
      )}
    </div>
  );
}
