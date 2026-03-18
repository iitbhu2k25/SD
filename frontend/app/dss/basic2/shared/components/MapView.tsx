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
  thematicMapData, thematicMapMethod, thematicMapYear,
  onThematicYearChange, onThematicMethodChange,
}: {
  selectedState?: string;
  selectedDistricts: string[];
  selectedSubDistricts: string[];
  selectedVillages: string[];
  onLocationSelect: (payload: any) => void;
  className?: string;
  thematicMapData?: { type: string; available_years: number[]; features: any[] } | null;
  thematicMapMethod?: string | null;
  thematicMapYear?: number | null;
  onThematicYearChange?: (year: number) => void;
  onThematicMethodChange?: (method: string) => void;
}) {
  return (
    <AdminMap
      selectedState={selectedState}
      selectedDistricts={selectedDistricts}
      selectedSubDistricts={selectedSubDistricts}
      selectedVillages={selectedVillages}
      onLocationSelect={onLocationSelect}
      className={className}
      thematicMapData={thematicMapData}
      thematicMapMethod={thematicMapMethod}
      thematicMapYear={thematicMapYear}
      onThematicYearChange={onThematicYearChange}
      onThematicMethodChange={onThematicMethodChange}
    />
  );
});

interface MapViewProps { className?: string; }

export default function MapView({ className }: MapViewProps) {
  const {
    mode,
    thematicMapData, thematicMapMethod, thematicMapYear,
    setThematicMapYear, setThematicMapMethod,
  } = useBasicStore();
  // Stable references — Zustand selectors return the same function objects across renders
  const onThematicYearChange = setThematicMapYear;
  const onThematicMethodChange = setThematicMapMethod;
  const { mapProps, handleMapLocationSelect } = useMapSelection();

  // Pre-mount all maps so switching modes never triggers a Leaflet re-init.
  const [mountedModes] = useState({ admin: true, drain: true, india_catchment: true });

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
            thematicMapData={thematicMapData}
            thematicMapMethod={thematicMapMethod}
            thematicMapYear={thematicMapYear}
            onThematicYearChange={onThematicYearChange}
            onThematicMethodChange={onThematicMethodChange}
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
