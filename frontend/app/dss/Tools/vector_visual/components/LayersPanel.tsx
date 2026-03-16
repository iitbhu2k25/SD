'use client';

import React, { useState } from 'react';
import AttributeTableModal from './AttributeTableModal';

interface ManagedLayer {
  id: string;
  name: string;
  layer: any;
  visible: boolean;
  type: 'geojson' | 'uploaded' | 'drawn';
}

interface LayersPanelProps {
  managedLayers: ManagedLayer[];
  isOpen: boolean;
  onToggle: () => void;
  onToggleVisibility: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleEditable: (id: string) => void;
  editableLayers: Set<string>;
  showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
  onFeatureSelect?: (feature: any, layer: any) => void;
}

export default function LayersPanel({
  managedLayers,
  isOpen,
  onToggle,
  onToggleVisibility,
  onRemove,
  onToggleEditable,
  editableLayers,
  showNotification,
  onFeatureSelect,
}: LayersPanelProps) {
  const [attrTable, setAttrTable] = useState<{
    open: boolean;
    layerId: string;
    layerName: string;
    leafletLayer: any;
  }>({ open: false, layerId: '', layerName: '', leafletLayer: null });

  const openAttributeTable = (ml: ManagedLayer) => {
    setAttrTable({
      open: true,
      layerId: ml.id,
      layerName: ml.name,
      leafletLayer: ml.layer,
    });
  };

  const closeAttributeTable = () => {
    setAttrTable(prev => ({ ...prev, open: false }));
  };

  const typeColor: Record<string, string> = {
    geojson: '#3b82f6',
    uploaded: '#10b981',
    drawn: '#f59e0b',
  };

  const typeLabel: Record<string, string> = {
    geojson: 'GeoJSON',
    uploaded: 'Shapefile',
    drawn: 'Drawn',
  };

  return (
    <>
      {/* Layers Toggle Button */}
      <div
        className="absolute pointer-events-auto"
        style={{ top: 12, right: 55, zIndex: 1000 }}
      >
        <button
          onClick={onToggle}
          title="Toggle Layers Panel"
          style={{
            background: isOpen
              ? 'linear-gradient(135deg, #0ea5e9, #2563eb)'
              : 'rgba(134, 76, 10, 0.79)',
            color: '#e2e8f0',
            border: '1px solid rgba(56,189,248,0.25)',
            borderRadius: 8,
            padding: '7px 13px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            letterSpacing: 0.5,
          }}
        >
          <span style={{ fontSize: 14 }}>🌐</span>
          Layers
          {managedLayers.length > 0 && (
            <span
              style={{
                background: isOpen ? 'rgb(224, 224, 224)' : '#1e4080',
                color: '#38bdf8',
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 10,
                fontWeight: 700,
              }}
            >
              {managedLayers.length}
            </span>
          )}
        </button>

        {/* Panel */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: 42,
              right: 0,
              width: 300,
              maxHeight: 420,
              background: 'rgb(250, 248, 248)',
              border: '1px solid rgba(56,189,248,0.15)',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Panel header */}
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid rgba(56,189,248,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  color: '#0c3772',
                  fontSize: 15,
                  letterSpacing: 0,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                }}
              >
                LAYERS
              </span>
              <span style={{ color: '#334155', fontSize: 10, fontFamily: 'monospace' }}>
                {managedLayers.length} layer{managedLayers.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Layer list */}
            <div style={{ overflowY: 'auto', maxHeight: 360 }}>
              {managedLayers.length === 0 ? (
                <div
                  style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    color: '#09428b',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    letterSpacing: 1,
                  }}
                >
                  NO LAYERS LOADED
                </div>
              ) : (
                [...managedLayers].reverse().map(ml => {
                  const isEditable = editableLayers.has(ml.id);
                  return (
                    <div
                      key={ml.id}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid rgba(6, 19, 43, 0.8)',
                        background: isEditable ? 'rgb(209, 197, 223)' : 'transparent',
                      }}
                    >
                      {/* Row 1: visibility + name + type badge */}
                      <div className="flex items-center gap-2">
                        {/* Visibility toggle */}
                        <button
                          onClick={() => onToggleVisibility(ml.id)}
                          title={ml.visible ? 'Hide layer' : 'Show layer'}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            fontSize: 14,
                            color: ml.visible ? '#d40707' : '#334155',
                            flexShrink: 0,
                          }}
                        >
                          {ml.visible ? '◉' : '○'}
                        </button>

                        {/* Layer name */}
                        <span
                          style={{
                            color: ml.visible ? '#030c18' : '#012352',
                            fontSize: 15,
                            fontWeight: 600,
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontFamily: 'system-ui, sans-serif',
                          }}
                          title={ml.name}
                        >
                          {ml.name}
                        </span>

                        {/* Type badge */}
                        <span
                          style={{
                            background: typeColor[ml.type] + '22',
                            color: typeColor[ml.type],
                            fontSize: 9,
                            padding: '1px 6px',
                            borderRadius: 10,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            fontFamily: 'monospace',
                            flexShrink: 0,
                          }}
                        >
                          {typeLabel[ml.type]}
                        </span>
                      </div>

                      {/* Row 2: action buttons */}
                      <div className="flex items-center gap-1 mt-2" style={{ paddingLeft: 24 }}>
                        {/* Attribute Table */}
                        <button
                          onClick={() => openAttributeTable(ml)}
                          title="Open Attribute Table"
                          style={{
                            background: 'rgb(226, 232, 235)',
                            border: '1px solid rgb(215, 219, 221)',
                            color: '#0d2c3a',
                            borderRadius: 5,
                            padding: '3px 8px',
                            fontSize: 9,
                            fontWeight: 700,
                            cursor: 'pointer',
                            letterSpacing: 0.5,
                            fontFamily: 'monospace',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            flexShrink: 0,
                          }}
                        >
                          ⊞ TABLE
                        </button>

                        {/* Edit toggle */}
                        <button
                          onClick={() => onToggleEditable(ml.id)}
                          title={isEditable ? 'Lock layer (disable editing)' : 'Unlock layer (enable editing)'}
                          style={{
                            background: isEditable
                              ? 'rgb(226, 238, 234)'
                              : 'rgb(238, 238, 238)',
                            border: `1px solid ${isEditable ? 'rgba(16,185,129,0.4)' : 'rgb(243, 244, 245)'}`,
                            color: isEditable ? '#10b981' : '#071331',
                            borderRadius: 5,
                            padding: '3px 8px',
                            fontSize: 9,
                            fontWeight: 700,
                            cursor: 'pointer',
                            letterSpacing: 0.5,
                            fontFamily: 'monospace',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            flexShrink: 0,
                          }}
                        >
                          {isEditable ? '🔓 EDIT ON' : '🔒 EDIT OFF'}
                        </button>

                        {/* Zoom to layer */}
                        <button
                          onClick={() => {
                            try {
                              const bounds = ml.layer?.getBounds?.();
                              if (bounds && bounds.isValid()) {
                                // Access map through window global
                                const mapContainer = document.querySelector('[data-map-root]') as any;
                                if (mapContainer && mapContainer._leaflet_id) {
                                  // use leaflet internal map
                                }
                                // Notify parent – simplest approach: fire custom event
                                window.dispatchEvent(new CustomEvent('zoomToLayer', { detail: { bounds } }));
                              }
                            } catch {}
                          }}
                          title="Zoom to layer"
                          style={{
                            background: 'rgba(116, 7, 88, 0.95)',
                            border: '1px solid rgb(205, 228, 220)',
                            color: '#d0d8e4',
                            borderRadius: 5,
                            padding: '3px 6px',
                            fontSize: 10,
                            cursor: 'pointer',
                          }}
                        >
                          ⌖
                        </button>

                        {/* Remove */}
                        <button
                          onClick={() => onRemove(ml.id)}
                          title="Remove layer"
                          style={{
                            background: 'rgba(127,29,29,0.15)',
                            border: '1px solid rgba(127,29,29,0.4)',
                            color: '#f87171',
                            borderRadius: 5,
                            padding: '3px 6px',
                            fontSize: 10,
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Attribute Table Modal */}
      <AttributeTableModal
        isOpen={attrTable.open}
        onClose={closeAttributeTable}
        layerName={attrTable.layerName}
        leafletLayer={attrTable.leafletLayer}
        showNotification={showNotification}
        onFeatureSelect={(feature, layer) => onFeatureSelect?.(feature, layer)}
      />
    </>
  );
}