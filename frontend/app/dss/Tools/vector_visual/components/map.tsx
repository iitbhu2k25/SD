// app/vector/components/Map.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import '../styles/leaflet-custom.css';
import IntersectionModal from './IntersectionModal';
import { SpatialAnalysisModal } from '../components';
import LayersPanel from './LayersPanel';
import OperationsPanel from './OperationsPanel';
import { uploadShapefile } from '../services/api.service';
import { BASEMAP_OPTIONS } from '../constants/app.constants';
import ExportModal from './ExportModal';
import LoadingOverlay from './LoadingOverlay';
import MapControls from './MapControls';
import CoordinatesDisplay from './CoordinatesDisplay';
import Compass from './Compass';
import BufferTool from './BufferTool';


interface MapProps {
  sidebarCollapsed: boolean;
  onFeatureClick: (feature: any, layer: any) => void;
  currentLayer: any;
  activeFeature: any;
  compassVisible: boolean;
  gridVisible: boolean;
  showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function Map(props: MapProps) {
  const { sidebarCollapsed, onFeatureClick, currentLayer, activeFeature, compassVisible, showNotification } = props;
  const [geoJsonLayer, setGeoJsonLayer] = useState<any>(null);
  const [uploadedLayer, setUploadedLayer] = useState<any>(null);
  const [coordinates, setCoordinates] = useState({ lat: 0, lng: 0 });
  const [loading, setLoading] = useState(false);
  const [bufferDistance, setBufferDistance] = useState(100);
  const [bufferToolVisible, setBufferToolVisible] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [intersectionModalOpen, setIntersectionModalOpen] = useState(false);
  const [spatialAnalysisModalOpen, setSpatialAnalysisModalOpen] = useState(false);
  const [initialOperationId, setInitialOperationId] = useState<string | undefined>(undefined);
  const [currentBasemap, setCurrentBasemap] = useState('traffic');
  const [mapReady, setMapReady] = useState(false);
  const [layersDropdownOpen, setLayersDropdownOpen] = useState(false);
  const [editableLayers, setEditableLayers] = useState<Set<string>>(new Set());
  const editableLayersGroupRef = useRef<any>(null);
  const [managedLayers, setManagedLayers] = useState<Array<{
    id: string;
    name: string;
    layer: any;
    visible: boolean;
    type: 'geojson' | 'uploaded' | 'drawn';
  }>>([]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [basemapOpen, setBasemapOpen] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null!) as React.RefObject<HTMLDivElement>;
  const mapInstanceRef = useRef<any>(null);
  const drawnItemsRef = useRef<any>(null);
  const baseLayersRef = useRef<{ [key: string]: any }>({});
  const currentBaseLayerRef = useRef<any>(null);
  const layerIdCounterRef = useRef(0);
  const basemapWidgetRef = useRef<HTMLDivElement>(null);

  const initializeLeaflet = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const L = require('leaflet');
    require('leaflet-draw');
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
    return L;
  }, []);

  const createBaseLayers = useCallback((L: any) => {
    return {
      streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }),
      satellite: L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps',
        maxZoom: 20,
      }),
      terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenTopoMap',
        maxZoom: 17,
      }),
      traffic: L.tileLayer('https://{s}.google.com/vt/lyrs=m@221097413,traffic&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Traffic',
        maxZoom: 20,
      }),
      hybrid: L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles © Esri',
          maxZoom: 19,
        }),
        L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}{r}.png', {
          attribution: 'Labels by Stamen',
          subdomains: 'abcd',
          maxZoom: 20,
          opacity: 0.7,
        }),
      ]),
      none: L.tileLayer('', { attribution: 'No basemap' }),
    };
  }, []);

  const addManagedLayer = useCallback((name: string, layer: any, type: 'geojson' | 'uploaded' | 'drawn') => {
    const id = `layer_${layerIdCounterRef.current++}`;
    setManagedLayers(prev => [...prev, { id, name, layer, visible: true, type }]);
    return id;
  }, []);

  const toggleLayerVisibility = useCallback((id: string) => {
    setManagedLayers(prev => prev.map(ml => {
      if (ml.id === id) {
        const newVisible = !ml.visible;
        if (mapInstanceRef.current && ml.layer) {
          if (newVisible) {
            if (!mapInstanceRef.current.hasLayer(ml.layer)) {
              mapInstanceRef.current.addLayer(ml.layer);
            }
          } else {
            if (mapInstanceRef.current.hasLayer(ml.layer)) {
              mapInstanceRef.current.removeLayer(ml.layer);
            }
          }
        }
        return { ...ml, visible: newVisible };
      }
      return ml;
    }));
  }, []);

  const toggleLayerEditable = useCallback((layerId: string) => {
    const layer = managedLayers.find(ml => ml.id === layerId);
    if (!layer) {
      console.warn('Layer not found:', layerId);
      return;
    }

    if (!editableLayersGroupRef.current) {
      console.error('Editable layers group not initialized');
      showNotification('Error', 'Edit system not ready', 'error');
      return;
    }

    const L = require('leaflet');
    const isCurrentlyEditable = editableLayers.has(layerId);

    try {
      if (isCurrentlyEditable) {
        if (typeof layer.layer.eachLayer === 'function') {
          layer.layer.eachLayer((subLayer: any) => {
            try {
              if (editableLayersGroupRef.current && editableLayersGroupRef.current.hasLayer(subLayer)) {
                editableLayersGroupRef.current.removeLayer(subLayer);
              }
            } catch (err) {
              console.warn('Error removing sublayer:', err);
            }
          });
        } else {
          if (editableLayersGroupRef.current.hasLayer(layer.layer)) {
            editableLayersGroupRef.current.removeLayer(layer.layer);
          }
        }

        setEditableLayers(prev => {
          const newSet = new Set(prev);
          newSet.delete(layerId);
          return newSet;
        });
        showNotification('Layer Locked', 'Layer is now read-only', 'info');
      } else {
        if (typeof layer.layer.eachLayer === 'function') {
          layer.layer.eachLayer((subLayer: any) => {
            try {
              if (editableLayersGroupRef.current && !editableLayersGroupRef.current.hasLayer(subLayer)) {
                editableLayersGroupRef.current.addLayer(subLayer);
              }
            } catch (err) {
              console.warn('Error adding sublayer:', err);
            }
          });
        } else {
          if (!editableLayersGroupRef.current.hasLayer(layer.layer)) {
            editableLayersGroupRef.current.addLayer(layer.layer);
          }
        }

        setEditableLayers(prev => new Set(prev).add(layerId));
        showNotification('Layer Unlocked', 'Layer is now editable - use edit tools', 'success');
      }
    } catch (error) {
      console.error('Toggle editable error:', error);
      showNotification('Error', 'Failed to toggle layer editability', 'error');
    }
  }, [managedLayers, editableLayers, showNotification]);

  const removeLayer = useCallback((id: string) => {
    setManagedLayers(prev => {
      const layerToRemove = prev.find(ml => ml.id === id);
      if (layerToRemove && layerToRemove.layer && mapInstanceRef.current) {
        if (mapInstanceRef.current.hasLayer(layerToRemove.layer)) {
          mapInstanceRef.current.removeLayer(layerToRemove.layer);
        }
      }
      return prev.filter(ml => ml.id !== id);
    });
    showNotification('Layer Removed', 'Layer has been removed from map', 'info');
  }, [showNotification]);

  const handleIntersectionComplete = useCallback((geojson: any) => {
    if (!mapInstanceRef.current) return;
    const L = require('leaflet');

    try {
      const lineColorElement = document.getElementById('lineColor') as HTMLInputElement | null;
      const weightElement = document.getElementById('weight') as HTMLInputElement | null;
      const fillColorElement = document.getElementById('fillColor') as HTMLInputElement | null;
      const opacityElement = document.getElementById('opacity') as HTMLInputElement | null;

      const lineColor = lineColorElement?.value || '#ff00ff';
      const weight = parseInt(weightElement?.value || '2', 10);
      const fillColor = fillColorElement?.value || '#ff00ff';
      const opacity = parseFloat(opacityElement?.value || '0.3');

      const canvasRenderer = L.canvas({ padding: 0.5 });
      const intersectionLayer = L.geoJSON(geojson, {
        renderer: canvasRenderer,
        style: () => ({
          color: lineColor,
          weight: weight,
          opacity: 1,
          fillColor: fillColor,
          fillOpacity: opacity,
        }),
        onEachFeature: (feature: any, layer: any) => {
          layer.on('click', (e: any) => {
            if (onFeatureClick) {
              L.DomEvent.stop(e);
              onFeatureClick(feature, layer);
            }
          });
        },
      });

      intersectionLayer.addTo(mapInstanceRef.current);

      const bounds = intersectionLayer.getBounds();
      if (bounds && bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 16 });
      }

      addManagedLayer('Intersection Result', intersectionLayer, 'geojson');
      showNotification('Success', 'Intersection result added to map', 'success');
    } catch (error: any) {
      showNotification('Error', 'Failed to plot intersection result', 'error');
    }
  }, [onFeatureClick, showNotification, addManagedLayer]);

  const handleSpatialAnalysisComplete = useCallback((geojson: any, operationName: string) => {
    if (!mapInstanceRef.current) return;
    const L = require('leaflet');

    try {
      const canvasRenderer = L.canvas({ padding: 0.5 });
      const resultLayer = L.geoJSON(geojson, {
        renderer: canvasRenderer,
        style: () => ({
          color: '#ff00ff',
          weight: 2,
          opacity: 1,
          fillColor: '#ff00ff',
          fillOpacity: 0.3,
        }),
        onEachFeature: (feature: any, layer: any) => {
          layer.on('click', (e: any) => {
            if (onFeatureClick) {
              L.DomEvent.stop(e);
              onFeatureClick(feature, layer);
            }
          });
        },
      });

      resultLayer.addTo(mapInstanceRef.current);

      const bounds = resultLayer.getBounds();
      if (bounds && bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 16 });
      }

      addManagedLayer(`${operationName} Result`, resultLayer, 'geojson');
      showNotification('Success', `${operationName} result added to map`, 'success');
    } catch (error: any) {
      showNotification('Error', 'Failed to plot result', 'error');
    }
  }, [onFeatureClick, showNotification, addManagedLayer]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = initializeLeaflet();
    if (!L) return;

    const initTimer = setTimeout(() => {
      try {
        if (!mapRef.current) return;
        const container = mapRef.current;
        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
          setTimeout(() => {
            if (mapRef.current && !mapInstanceRef.current) {
              initMap();
            }
          }, 500);
          return;
        }
        initMap();
      } catch {
        showNotification('Error', 'Failed to initialize map', 'error');
      }
    }, 100);

    const initMap = () => {
      if (!mapRef.current || mapInstanceRef.current) return;
      const map = L.map(mapRef.current, {
        center: [22.3511, 78.6677],
        zoom: 5,
        zoomControl: false,
        preferCanvas: true,
        renderer: L.canvas({ padding: 0.5 })
      });
      mapInstanceRef.current = map;

      const baseLayers = createBaseLayers(L);
      baseLayersRef.current = baseLayers;

      const defaultLayer = baseLayers[currentBasemap as keyof typeof baseLayers];
      if (defaultLayer) {
        defaultLayer.addTo(map);
        currentBaseLayerRef.current = defaultLayer;
      }

      // ── Interactive scale bar (click to toggle metric/imperial) ──
      let scaleMetric = true;
      const scaleControl = L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);
      const scaleEl = scaleControl.getContainer() as HTMLElement;
      scaleEl.style.cursor = 'pointer';
      scaleEl.title = 'Click to toggle km / miles';
      scaleEl.style.transition = 'opacity 0.15s';
      scaleEl.addEventListener('mouseenter', () => { scaleEl.style.opacity = '0.75'; });
      scaleEl.addEventListener('mouseleave', () => { scaleEl.style.opacity = '1'; });
      scaleEl.addEventListener('click', () => {
        scaleMetric = !scaleMetric;
        scaleControl.options.metric = scaleMetric;
        scaleControl.options.imperial = !scaleMetric;
        (scaleControl as any)._update();
      });

      const drawnItems = new L.FeatureGroup(undefined as any, { renderer: L.canvas() } as any);
      map.addLayer(drawnItems);
      drawnItemsRef.current = drawnItems;

      const editableLayersGroup = new L.FeatureGroup(undefined as any, { renderer: L.canvas() } as any);
      map.addLayer(editableLayersGroup);
      editableLayersGroupRef.current = editableLayersGroup;

      const drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
          polyline: { shapeOptions: { color: 'red', weight: 3 } },
          polygon: {
            allowIntersection: false,
            drawError: { color: 'red', timeout: 1000 },
            shapeOptions: { color: 'red' },
          },
          circle: { shapeOptions: { color: 'red' } },
          marker: true,
          rectangle: { shapeOptions: { color: 'red' } },
          circlemarker: false,
        },
        edit: {
          featureGroup: drawnItems,
          remove: true,
          edit: {
            selectedPathOptions: {
              dashArray: '10, 10',
              fill: true,
              fillColor: '#fe57a1',
              fillOpacity: 0.1,
              maintainColor: false,
            }
          }
        },
      });
      map.addControl(drawControl);

      const editLoadedControl = new L.Control.Draw({
        position: 'topright',
        draw: false,
        edit: {
          featureGroup: editableLayersGroup,
          remove: true,
          edit: {
            selectedPathOptions: {
              dashArray: '10, 10',
              fill: true,
              fillColor: '#4CAF50',
              fillOpacity: 0.1,
              maintainColor: false,
            }
          }
        },
      });
      map.addControl(editLoadedControl);

      map.on('mousemove', (e: any) => {
        try {
          setCoordinates({
            lat: parseFloat(e.latlng.lat.toFixed(5)),
            lng: parseFloat(e.latlng.lng.toFixed(5)),
          });
        } catch { /* noop */ }
      });

      map.on(L.Draw.Event.CREATED, (event: any) => {
        try {
          const layer = event.layer;

          if (!layer.feature) {
            layer.feature = {
              type: 'Feature',
              geometry: null,
              properties: {
                name: `Drawn ${event.layerType}`,
                created: new Date().toISOString(),
                type: event.layerType
              }
            };
          }

          drawnItems.addLayer(layer);
          drawnItems.eachLayer((l: any) => { l._selected = false; });
          layer._selected = true;

          const layerType = event.layerType;
          addManagedLayer(`Drawn ${layerType}`, layer, 'drawn');

          if (layer instanceof L.Polygon) {
            const latlngs: any[] = (layer.getLatLngs() as any[]).flat(2);
            let area = 0;
            for (let i = 0; i < latlngs.length; i++) {
              const j = (i + 1) % latlngs.length;
              area += latlngs[i].lng * latlngs[j].lat;
              area -= latlngs[j].lng * latlngs[i].lat;
            }
            area = Math.abs(area) * 0.5 * 111.32 * 111.32;

            if (layer.feature && layer.feature.properties) {
              layer.feature.properties.area_sq_km = area.toFixed(2);
            }

            layer.bindPopup(`<strong>Area:</strong> ${area.toFixed(2)} sq km`).openPopup();
          }

          layer.on('click', (e: any) => {
            if (onFeatureClick) {
              L.DomEvent.stop(e);
              onFeatureClick(layer.feature, layer);
            }
          });
        } catch { /* noop */ }
      });

      map.on(L.Draw.Event.EDITED, (event: any) => {
        try {
          const layers = event.layers;
          let editedCount = 0;

          layers.eachLayer((layer: any) => {
            if (layer.feature && typeof layer.toGeoJSON === 'function') {
              const updatedGeoJSON = layer.toGeoJSON();
              if (updatedGeoJSON && updatedGeoJSON.geometry) {
                layer.feature.geometry = updatedGeoJSON.geometry;
                editedCount++;
              }
            }
          });

          if (editedCount > 0) {
            showNotification('Success', `${editedCount} feature(s) updated`, 'success');
          }
        } catch (error) {
          console.error('Edit error:', error);
          showNotification('Error', 'Failed to update geometries', 'error');
        }
      });

      map.on(L.Draw.Event.DELETED, (event: any) => {
        try {
          const layers = event.layers;
          let deletedCount = 0;
          layers.eachLayer(() => { deletedCount++; });
          if (deletedCount > 0) {
            showNotification('Success', `${deletedCount} feature(s) deleted`, 'success');
          }
        } catch (error) {
          showNotification('Error', 'Failed to delete features', 'error');
        }
      });

      map.on('error', () => { /* noop */ });

      // ── ZoomToLayer / ZoomToLatLng events from AttributeTable row clicks ──
      const handleZoomToLayer = (e: any) => {
        try {
          const bounds = e.detail?.bounds;
          if (bounds && mapInstanceRef.current) {
            mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
          }
        } catch { /* noop */ }
      };
      const handleZoomToLatLng = (e: any) => {
        try {
          const { latlng, zoom } = e.detail || {};
          if (latlng && mapInstanceRef.current) {
            mapInstanceRef.current.setView(latlng, zoom ?? 16);
          }
        } catch { /* noop */ }
      };
      window.addEventListener('zoomToLayer', handleZoomToLayer);
      window.addEventListener('zoomToLatLng', handleZoomToLatLng);

      const handleResize = () => {
        if (mapInstanceRef.current) {
          try {
            setTimeout(() => {
              mapInstanceRef.current?.invalidateSize();
            }, 100);
          } catch { /* noop */ }
        }
      };
      window.addEventListener('resize', handleResize);

      setMapReady(true);
      // Re-measure after CSS calc() settles
      requestAnimationFrame(() => {
        setTimeout(() => { map.invalidateSize({ animate: false }); }, 80);
      });

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('zoomToLayer', handleZoomToLayer);
        window.removeEventListener('zoomToLatLng', handleZoomToLatLng);
        setMapReady(false);
        if (mapInstanceRef.current) {
          try { mapInstanceRef.current.remove(); } catch { /* noop */ }
          mapInstanceRef.current = null;
        }
      };
    };

    return () => clearTimeout(initTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializeLeaflet, createBaseLayers, showNotification, addManagedLayer]);

  const changeBasemap = useCallback((basemapId: string) => {
    if (!mapInstanceRef.current || !baseLayersRef.current) return;
    try {
      if (currentBaseLayerRef.current && mapInstanceRef.current.hasLayer(currentBaseLayerRef.current)) {
        mapInstanceRef.current.removeLayer(currentBaseLayerRef.current);
      }
      if (basemapId !== 'none' && baseLayersRef.current[basemapId]) {
        const newLayer = baseLayersRef.current[basemapId];
        if (newLayer && typeof newLayer.addTo === 'function') {
          newLayer.addTo(mapInstanceRef.current);
          currentBaseLayerRef.current = newLayer;
          setTimeout(() => {
            try {
              newLayer.redraw?.();
              mapInstanceRef.current?.invalidateSize?.();
            } catch { /* noop */ }
          }, 100);
        } else {
          currentBaseLayerRef.current = null;
        }
      } else {
        currentBaseLayerRef.current = null;
      }
      setCurrentBasemap(basemapId);
      const basemapName = basemapId.charAt(0).toUpperCase() + basemapId.slice(1);
      showNotification('Basemap Changed', `Switched to ${basemapName} basemap`, 'info');
    } catch {
      showNotification('Error', 'Failed to change basemap', 'error');
    }
  }, [showNotification]);

  const loadGeoJSON = useCallback(async (geoJsonData: any, styleOptions?: any) => {
    const waitForMap = () => new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const check = () => {
        if (mapInstanceRef.current) return resolve();
        if (Date.now() - started > 10000) return reject(new Error('Map initialization timeout'));
        setTimeout(check, 100);
      };
      check();
    });

    try {
      setLoading(true);
      await waitForMap();
      if (!mapInstanceRef.current) throw new Error('Map not initialized after waiting');

      if (!geoJsonData.features || geoJsonData.features.length === 0) {
        throw new Error('No feature data received');
      }

      const L = require('leaflet');

      if (geoJsonLayer && mapInstanceRef.current.hasLayer(geoJsonLayer)) {
        mapInstanceRef.current.removeLayer(geoJsonLayer);
      }
      if (uploadedLayer && mapInstanceRef.current.hasLayer(uploadedLayer)) {
        mapInstanceRef.current.removeLayer(uploadedLayer);
        setUploadedLayer(null);
      }

      const lineColor = styleOptions?.lineColor || (document.getElementById('lineColor') as HTMLInputElement)?.value || 'red';
      const weight = styleOptions?.weight || parseInt((document.getElementById('weight') as HTMLInputElement)?.value || '2', 10);
      const fillColor = styleOptions?.fillColor || (document.getElementById('fillColor') as HTMLInputElement)?.value || '#78b4db';
      const opacity = styleOptions?.opacity || parseFloat((document.getElementById('opacity') as HTMLInputElement)?.value || '0.1');

      const canvasRenderer = L.canvas({ padding: 0.5 });
      const newLayer = L.geoJSON(geoJsonData, {
        renderer: canvasRenderer,
        style: () => ({
          color: lineColor,
          weight: weight,
          opacity: 1,
          fillColor: fillColor,
          fillOpacity: opacity,
        }),
        onEachFeature: (feature: any, layer: any) => {
          layer.on('click', (e: any) => {
            if (onFeatureClick) {
              L.DomEvent.stop(e);
              onFeatureClick(feature, layer);
            }
          });
        },
      });

      if (!mapInstanceRef.current) throw new Error('Map instance lost during processing');

      newLayer.addTo(mapInstanceRef.current);

      const b = (newLayer as any).getBounds?.();
      if (b && b.isValid() && mapInstanceRef.current) {
        try {
          mapInstanceRef.current.fitBounds(b, { padding: [20, 20], maxZoom: 16 });
        } catch {
          const center = b.getCenter();
          mapInstanceRef.current.setView([center.lat, center.lng], 10);
        }
      }

      setGeoJsonLayer(newLayer);

      const layerName =
        styleOptions?.name                                          // from Sidebar upload (filename)
        ?? geoJsonData._source_file                               // from SSE backend response
        ?? (geoJsonData.category && geoJsonData.subcategory
            ? `${geoJsonData.category} — ${geoJsonData.subcategory}`
            : undefined)
        ?? geoJsonData.name
        ?? 'Loaded Vector Data';

      addManagedLayer(layerName, newLayer, 'geojson');
      showNotification('Success', 'Layer loaded - click Edit button to enable editing', 'success');

      return newLayer;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      showNotification('Error', `Failed to load data: ${message}`, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [geoJsonLayer, uploadedLayer, onFeatureClick, showNotification, addManagedLayer]);

  const updateLayerStyles = useCallback(() => {
    if (!geoJsonLayer && !uploadedLayer) return;
    const lineColor = (document.getElementById('lineColor') as HTMLInputElement | null)?.value || '#000000';
    const weight = parseInt((document.getElementById('weight') as HTMLInputElement | null)?.value || '2', 10);
    const fillColor = (document.getElementById('fillColor') as HTMLInputElement | null)?.value || '#78b4db';
    const fillOpacity = parseFloat((document.getElementById('opacity') as HTMLInputElement | null)?.value || '0.1');

    if (geoJsonLayer) geoJsonLayer.setStyle({ color: lineColor, weight, opacity: 1, fillColor, fillOpacity });
    if (uploadedLayer) uploadedLayer.setStyle({ color: lineColor, weight, opacity: 1, fillColor, fillOpacity });
  }, [geoJsonLayer, uploadedLayer]);

  const handleUploadShapefile = useCallback(async (files: FileList) => {
    try {
      setLoading(true);

      const geojson = await uploadShapefile(files);
      const L = require('leaflet');

      if (uploadedLayer && mapInstanceRef.current?.hasLayer(uploadedLayer)) {
        mapInstanceRef.current.removeLayer(uploadedLayer);
        setUploadedLayer(null);
      }
      if (geoJsonLayer && mapInstanceRef.current?.hasLayer(geoJsonLayer)) {
        mapInstanceRef.current.removeLayer(geoJsonLayer);
        setGeoJsonLayer(null);
      }

      const lineColorElement = document.getElementById('lineColor') as HTMLInputElement | null;
      const weightElement = document.getElementById('weight') as HTMLInputElement | null;
      const fillColorElement = document.getElementById('fillColor') as HTMLInputElement | null;
      const opacityElement = document.getElementById('opacity') as HTMLInputElement | null;

      const lineColor = lineColorElement?.value || 'red';
      const weight = parseInt(weightElement?.value || '2', 10);
      const fillColor = fillColorElement?.value || '#78b4db';
      const opacity = parseFloat(opacityElement?.value || '0.1');

      const canvasRenderer = L.canvas({ padding: 0.5 });
      const layer = L.geoJSON(geojson, {
        renderer: canvasRenderer,
        style: () => ({
          color: lineColor,
          weight,
          opacity: 1,
          fillColor,
          fillOpacity: opacity,
        }),
        onEachFeature: (feature: any, lyr: any) => {
          lyr.on('click', (e: any) => {
            if (onFeatureClick) {
              L.DomEvent.stop(e);
              onFeatureClick(feature, lyr);
            }
          });
        },
      });

      layer.addTo(mapInstanceRef.current);

      try {
        const b = (layer as any).getBounds?.();
        if (b && b.isValid()) {
          mapInstanceRef.current.fitBounds(b, { padding: [20, 20], maxZoom: 16 });
        }
      } catch { /* noop */ }

      setUploadedLayer(layer);

      const fileName = Array.from(files).find(f => f.name.endsWith('.shp') || f.name.endsWith('.zip'))?.name || 'Uploaded Shapefile';
      addManagedLayer(fileName, layer, 'uploaded');

      showNotification('Success', 'Shapefile uploaded - click Edit button to enable editing', 'success');
      return geojson;
    } catch (error: any) {
      showNotification('Error', error.message, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [geoJsonLayer, uploadedLayer, onFeatureClick, showNotification, addManagedLayer]);

  const handleHomeClick = useCallback(() => {
    mapInstanceRef.current?.setView([22.3511, 78.6677], 5);
    showNotification('Map Reset', 'Returned to default view', 'info');
  }, [showNotification]);

  const handleFeaturePropertiesUpdate = useCallback((updatedProperties: Record<string, any>) => {
    if (!activeFeature) return;
    try {
      if (activeFeature.feature && activeFeature.feature.properties) {
        activeFeature.feature.properties = { ...updatedProperties };
      } else {
        if (!activeFeature.feature) {
          activeFeature.feature = { type: 'Feature', geometry: null, properties: {} };
        }
        activeFeature.feature.properties = { ...updatedProperties };
      }

      if (typeof activeFeature.toGeoJSON === 'function') {
        const geoJsonFeature = activeFeature.toGeoJSON();
        if (geoJsonFeature) {
          geoJsonFeature.properties = { ...updatedProperties };
          if (activeFeature.feature) {
            activeFeature.feature.properties = { ...updatedProperties };
          }
        }
      }

      showNotification('Success', 'Feature properties updated', 'success');
    } catch (error) {
      console.error('Error updating properties:', error);
      showNotification('Error', 'Failed to update feature properties', 'error');
    }
  }, [activeFeature, showNotification]);

  const handleLocateClick = useCallback(() => {
    if (!mapInstanceRef.current) return;
    showNotification('Location', 'Finding your location...', 'info');
    mapInstanceRef.current
      .locate({ setView: true, maxZoom: 16 })
      .on('locationfound', (e: any) => {
        const L = require('leaflet');
        L.circleMarker(e.latlng, {
          radius: 8,
          color: 'red',
          weight: 3,
          opacity: 1,
          fillColor: '#3498db',
          fillOpacity: 0.4,
        }).addTo(mapInstanceRef.current);
        showNotification('Location Found', 'Your location has been found', 'success');
      })
      .on('locationerror', () => {
        showNotification('Location Error', 'Could not find your location', 'error');
      });
  }, [showNotification]);

  const handleFullScreen = useCallback(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => { });
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!basemapOpen) return;
    const close = (e: MouseEvent) => {
      if (basemapWidgetRef.current?.contains(e.target as Node)) return;
      setBasemapOpen(false);
    };
    window.addEventListener('click', close, true);
    return () => window.removeEventListener('click', close, true);
  }, [basemapOpen]);

  const createBuffer = useCallback(() => {
    if (!mapInstanceRef.current || !drawnItemsRef.current) return;

    let selectedLayer: any = null;
    drawnItemsRef.current.eachLayer((layer: any) => {
      if (layer._selected) selectedLayer = layer;
    });
    if (!selectedLayer) {
      let lastLayer: any = null;
      drawnItemsRef.current.eachLayer((layer: any) => { lastLayer = layer; });
      selectedLayer = lastLayer;
    }
    if (!selectedLayer) {
      showNotification('Buffer Error', 'Please draw a feature first', 'error');
      return;
    }

    try {
      const L = require('leaflet');
      if (selectedLayer.getLatLng) {
        const circle = L.circle(selectedLayer.getLatLng(), {
          radius: bufferDistance,
          color: '#9c27b0',
          fillColor: '#9c27b0',
          fillOpacity: 0.2,
          weight: 2,
        });
        circle.addTo(drawnItemsRef.current);
        circle.bindPopup(`Buffer: ${bufferDistance}m`);
        addManagedLayer(`Buffer ${bufferDistance}m`, circle, 'drawn');
      }
      showNotification('Buffer Created', `${bufferDistance}m buffer created`, 'success');
    } catch {
      showNotification('Buffer Error', 'Failed to create buffer', 'error');
    }
  }, [bufferDistance, showNotification, addManagedLayer]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 300);
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!activeFeature) return;
    const L = require('leaflet');

    managedLayers.forEach(ml => {
      if (ml.layer && ml.visible) {
        if (typeof ml.layer.eachLayer === 'function') {
          ml.layer.eachLayer((layer: any) => {
            if (layer !== activeFeature) {
              if (layer instanceof L.Path) {
                ml.layer.resetStyle(layer);
              }
              if (layer instanceof L.Marker && layer._highlightCircle) {
                mapInstanceRef.current?.removeLayer(layer._highlightCircle);
                delete layer._highlightCircle;
              }
            }
          });
        }
      }
    });

    if (drawnItemsRef.current) {
      drawnItemsRef.current.eachLayer((layer: any) => {
        if (layer !== activeFeature) {
          if (layer instanceof L.Path) {
            layer.setStyle({ color: 'red', weight: 3, fillOpacity: 0.2 });
          }
          if (layer instanceof L.Marker && layer._highlightCircle) {
            mapInstanceRef.current?.removeLayer(layer._highlightCircle);
            delete layer._highlightCircle;
          }
        }
      });
    }

    if ((activeFeature as any)?.getLatLng) {
      if (activeFeature._highlightCircle) {
        mapInstanceRef.current?.removeLayer(activeFeature._highlightCircle);
      }
      const highlightCircle = L.circle(activeFeature.getLatLng(), {
        radius: 20,
        color: '#ff4444',
        weight: 3,
        opacity: 0.7,
        fillColor: '#ff4444',
        fillOpacity: 0.3,
      }).addTo(mapInstanceRef.current);
      (activeFeature as any)._highlightCircle = highlightCircle;
    } else if (activeFeature instanceof L.Path) {
      activeFeature.setStyle({ weight: 4, color: '#ff4444', fillOpacity: 0.7 });
    }

    return () => {
      if ((activeFeature as any)?._highlightCircle) {
        mapInstanceRef.current?.removeLayer((activeFeature as any)._highlightCircle);
        delete (activeFeature as any)._highlightCircle;
      }
    };
  }, [activeFeature, managedLayers]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.changeBasemap = changeBasemap;
      window.loadGeoJSON = (geoJsonData: any, styleOptions?: any) => loadGeoJSON(geoJsonData, styleOptions);
      window.updateMapStyles = updateLayerStyles;
      window.toggleBufferTool = () => setBufferToolVisible((prev) => !prev);
      window.uploadShapefile = handleUploadShapefile;
      window.openIntersectionModal = () => setIntersectionModalOpen(true);
      window.openSpatialAnalysisModal = (operationId?: string) => {
        setInitialOperationId(operationId);
        setSpatialAnalysisModalOpen(true);
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete window.changeBasemap;
        delete window.loadGeoJSON;
        delete window.updateMapStyles;
        delete window.toggleBufferTool;
        delete window.uploadShapefile;
        delete window.openIntersectionModal;
        delete window.openSpatialAnalysisModal;
      }
    };
  }, [changeBasemap, loadGeoJSON, updateLayerStyles, handleUploadShapefile]);

  return (
    <div ref={mapContainerRef} className="relative w-full h-full" style={{ background: '#dde3ea' }}>
      <div
        ref={mapRef}
        data-map-root
        style={{
          position: 'absolute',
          zIndex: 0,          /* creates stacking context — traps all Leaflet internal z-indices inside */
          top: 8,
          left: 8,
          width: 'calc(100% - 16px)',
          height: 'calc(100% - 16px)',
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: '#e8edf2',
          boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
        }}
      />

      <div
        className="absolute z-10 pointer-events-none"
        style={{ top: 8, left: 8, width: 'calc(100% - 16px)', height: 'calc(100% - 16px)' }}
      >
        <CoordinatesDisplay coordinates={coordinates} />
        <Compass visible={compassVisible} />
        <LoadingOverlay
          visible={loading || !mapReady}
          message={!mapReady ? 'Initializing map...' : 'Loading vector data...'}
        />

        {/* ── Layers Panel — now receives showNotification + onFeatureSelect ── */}
        <LayersPanel
          managedLayers={managedLayers}
          isOpen={layersDropdownOpen}
          onToggle={() => setLayersDropdownOpen(!layersDropdownOpen)}
          onToggleVisibility={toggleLayerVisibility}
          onRemove={removeLayer}
          onToggleEditable={toggleLayerEditable}
          editableLayers={editableLayers}
          showNotification={showNotification}
          onFeatureSelect={onFeatureClick}
        />

        <OperationsPanel
          onOpenSpatialAnalysis={(opId?: string) => {
            setInitialOperationId(opId);
            setSpatialAnalysisModalOpen(true);
          }}
        />

        <MapControls
          mapInstance={mapInstanceRef.current}
          onHomeClick={handleHomeClick}
          onLocateClick={handleLocateClick}
          onFullScreen={handleFullScreen}
          onBufferToggle={() => setBufferToolVisible(!bufferToolVisible)}
          onExportClick={() => setExportModalOpen(true)}
        />

        {/* ── Basemap Selector — Leaflet-style compact icon button ── */}
        <div ref={basemapWidgetRef} className="absolute pointer-events-auto" style={{ top: 216, left: 10, zIndex: 1002 }}>
          <div style={{ position: 'relative' }}>
            {/* Icon button matching zoom strip style */}
            <button
              onClick={() => setBasemapOpen(p => !p)}
              title={`Basemap: ${BASEMAP_OPTIONS.find(b => b.id === currentBasemap)?.label ?? ''}`}
              style={{
                width: 30, height: 30,
                background: basemapOpen ? '#1e40af' : 'rgba(255,255,255,0.95)',
                border: '1px solid rgba(0,0,0,0.25)',
                borderRadius: 4,
                boxShadow: '0 1px 5px rgba(0,0,0,0.35)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: basemapOpen ? '#fff' : '#444',
                transition: 'all 0.15s',
                padding: 0,
              }}
              onMouseEnter={e => { if (!basemapOpen) { (e.currentTarget as HTMLElement).style.background = '#f4f4f4'; (e.currentTarget as HTMLElement).style.color = '#1e40af'; } }}
              onMouseLeave={e => { if (!basemapOpen) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.95)'; (e.currentTarget as HTMLElement).style.color = '#444'; } }}
            >
              {/* Layers stack SVG icon */}
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 6l7-4 7 4-7 4-7-4z"/>
                <path d="M1 10l7 4 7-4"/>
              </svg>
            </button>

            {/* Dropdown */}
            {basemapOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                boxShadow: '0 6px 24px rgba(0,0,0,0.15)', padding: '6px 0', minWidth: 148, zIndex: 2100,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, fontFamily: 'monospace', padding: '2px 10px 5px' }}>BASEMAP</div>
                {BASEMAP_OPTIONS.map(opt => (
                  <button key={opt.id} onClick={() => { changeBasemap(opt.id); setBasemapOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                      padding: '5px 10px', border: 'none', cursor: 'pointer', fontSize: 11,
                      background: currentBasemap === opt.id ? '#eff6ff' : 'transparent',
                      color: currentBasemap === opt.id ? '#2563eb' : '#334155',
                      fontWeight: currentBasemap === opt.id ? 700 : 400,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (currentBasemap !== opt.id) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (currentBasemap !== opt.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <i className="fg-wmts" style={{ fontSize: 11, opacity: 0.7 }} />
                    {opt.label}
                    {currentBasemap === opt.id && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#2563eb' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>


        <BufferTool
          visible={bufferToolVisible}
          distance={bufferDistance}
          onDistanceChange={setBufferDistance}
          onCreateBuffer={createBuffer}
        />

        <LoadingOverlay
          visible={loading || !mapReady}
          message={!mapReady ? 'Initializing map...' : 'Loading vector data...'}
        />
      </div>

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        mapRef={mapRef}
        mapInstance={mapInstanceRef.current}
        managedLayers={managedLayers}
        drawnItems={drawnItemsRef.current}
        currentBasemap={currentBasemap}
        showNotification={showNotification}
      />

      <IntersectionModal
        isOpen={intersectionModalOpen}
        onOpenChange={setIntersectionModalOpen}
        managedLayers={managedLayers}
        showNotification={showNotification}
        onIntersectionComplete={handleIntersectionComplete}
      />

      <SpatialAnalysisModal
        isOpen={spatialAnalysisModalOpen}
        onOpenChange={setSpatialAnalysisModalOpen}
        managedLayers={managedLayers}
        showNotification={showNotification}
        onAnalysisComplete={handleSpatialAnalysisComplete}
        initialOperationId={initialOperationId}
      />
    </div>
  );
}