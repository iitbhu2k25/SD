//file: frontend/app/dss/visualizations/vector/page.tsx
'use client';

import React, { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from './components/sidebar';
import Features from './components/features';
import { Notification } from './components';

// Dynamically import Map component to avoid SSR issues with Leaflet
const Map = dynamic(() => import("./components/map"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full border-4 border-gray-300 rounded-xl">
      <div className="text-gray-500">Loading map...</div>
    </div>
  )
});

export default function VectorPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [featureInfoVisible, setFeatureInfoVisible] = useState(true);
  const [currentLayer, setCurrentLayer] = useState<any>(null);
  const [activeFeature, setActiveFeature] = useState<any>(null);
  const [compassVisible, setCompassVisible] = useState(true);
  const [gridVisible, setGridVisible] = useState<boolean>(true);

  // Notification state
  const [notification, setNotification] = useState({
    show: false,
    title: '',
    message: '',
    type: 'success'
  });

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Called from both map clicks AND attribute table row clicks
  // Signature: (feature, layer) where feature may be null/undefined for drawn layers
  const handleFeatureClick = useCallback((feature: any, layer: any) => {
    // Guard: layer must exist
    if (!layer) return;

    // Ensure the layer has a feature object
    if (!layer.feature) {
      layer.feature = {
        type: 'Feature',
        geometry: null,
        properties: feature?.properties || {}
      };
    }
    if (!layer.feature.properties) {
      layer.feature.properties = feature?.properties || {};
    }

    setActiveFeature(layer);
    setCurrentLayer(layer);
  }, []);

  const handleFeatureInfoToggle = (visible: boolean) => {
    setFeatureInfoVisible(visible);
  };

  const handleCompassToggle = (visible: boolean) => {
    setCompassVisible(visible);
  };

  const handleGridToggle = (visible: boolean) => {
    setGridVisible(visible);
  };

  const showNotification = useCallback((title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ show: true, title, message, type });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 4000);
  }, []);

  // Upload handler to be passed to sidebar
  const handleUploadShapefile = async (files: FileList) => {
    if (typeof window !== 'undefined' && window.uploadShapefile) {
      return await window.uploadShapefile(files);
    }
    return null;
  };

  const handleFeaturePropertiesUpdate = useCallback((updatedProperties: Record<string, any>) => {
    if (!activeFeature) return;

    try {
      // Ensure feature object exists
      if (!activeFeature.feature) {
        activeFeature.feature = {
          type: 'Feature',
          geometry: null,
          properties: {}
        };
      }

      // Update the properties
      activeFeature.feature.properties = { ...updatedProperties };

      // If it's a GeoJSON layer, update the underlying data
      if (typeof activeFeature.toGeoJSON === 'function') {
        try {
          const geoJsonFeature = activeFeature.toGeoJSON();
          if (geoJsonFeature && geoJsonFeature.properties) {
            geoJsonFeature.properties = { ...updatedProperties };
          }
        } catch (e) {
          console.warn('Could not update toGeoJSON:', e);
        }
      }

      // Force re-render of Features panel by updating activeFeature reference
      setActiveFeature((prev: any) => {
        if (!prev) return prev;
        // Create a shallow clone so React sees a new reference
        const clone = Object.create(Object.getPrototypeOf(prev));
        Object.assign(clone, prev);
        if (!clone.feature) clone.feature = { type: 'Feature', geometry: null, properties: {} };
        clone.feature = { ...clone.feature, properties: { ...updatedProperties } };
        return clone;
      });

      showNotification('Success', 'Feature properties updated successfully', 'success');
    } catch (error) {
      console.error('Error updating feature properties:', error);
      showNotification('Error', 'Failed to update feature properties', 'error');
    }
  }, [activeFeature, showNotification]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-blue-600 text-white p-3 shadow-md z-10">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className="fas fa-globe-asia text-2xl mr-2"></i>
              <h3 className="text-xl font-semibold m-0">(DSS-WRM) IIT BHU Vector Data Viewer Tool</h3>
            </div>
            <div className="text-right">
              <span className="text-light">Advanced Geospatial Analysis Tool</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Sidebar */}
        <div
          style={{
            width: sidebarCollapsed ? 0 : 300,
            transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
            overflow: 'hidden',
            flexShrink: 0,
            height: '100%',
            position: 'relative',
          }}
        >
          <div style={{ width: 300, height: '100%', overflowY: 'auto' }}>
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggle={handleSidebarToggle}
              onMapLayerChange={setCurrentLayer}
              onFeatureInfoToggle={handleFeatureInfoToggle}
              onCompassToggle={handleCompassToggle}
              onGridToggle={handleGridToggle}
              showNotification={showNotification}
              onUploadShapefile={handleUploadShapefile}
            />
          </div>
        </div>

        {/* Sidebar toggle tab — sits at the seam, vertically centred, never overlaps zoom controls */}
        <button
          onClick={handleSidebarToggle}
          title={sidebarCollapsed ? 'Open panel' : 'Close panel'}
          style={{
            position: 'absolute',
            left: sidebarCollapsed ? 0 : 300,
            top: '50%',
            transform: 'translateY(-50%)',
            transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1)',
            zIndex: 1100,
            background: 'linear-gradient(180deg, #1e3a5f 0%, #1e40af 100%)',
            border: 'none',
            borderRadius: '0 6px 6px 0',
            width: 18,
            height: 56,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#93c5fd',
            fontSize: 13,
            fontWeight: 700,
            boxShadow: '2px 0 8px rgba(0,0,0,0.22)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'linear-gradient(180deg, #1e40af 0%, #2563eb 100%)';
            (e.currentTarget as HTMLElement).style.color = '#fff';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'linear-gradient(180deg, #1e3a5f 0%, #1e40af 100%)';
            (e.currentTarget as HTMLElement).style.color = '#93c5fd';
          }}
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>

        {/* Map and Features container */}
        <div className="flex-1 relative h-full">
          <Map
            sidebarCollapsed={sidebarCollapsed}
            onFeatureClick={handleFeatureClick}
            currentLayer={currentLayer}
            activeFeature={activeFeature}
            compassVisible={compassVisible}
            gridVisible={gridVisible}
            showNotification={showNotification}
          />

          {/* Feature properties — compact floating card over the map */}
          {featureInfoVisible && activeFeature?.feature?.properties && (
            <div
              style={{
                position: 'absolute',
                bottom: 140,
                right: 16,
                zIndex: 1000,
                pointerEvents: 'auto',
                animation: 'slideUpFeature 0.22s cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <Features
                properties={activeFeature?.feature?.properties ?? null}
                onClose={() => setActiveFeature(null)}
                onSave={handleFeaturePropertiesUpdate}
              />
            </div>
          )}
        </div>
      </div>

      {/* Notification */}
      <Notification notification={notification} />
    </div>
  );
}