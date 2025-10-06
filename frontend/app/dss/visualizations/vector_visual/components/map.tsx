// app/vector/components/Map.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

declare global {
  interface Window {
    toggleBufferTool?: () => void;
    changeBasemap?: (basemapId: string) => void;
    loadGeoJSON?: (category: string, subcategory: string) => Promise<any | null>;
    updateMapStyles?: () => void;
    uploadShapefile?: (files: FileList) => Promise<any>;
  }
}

interface MapProps {
  sidebarCollapsed: boolean;
  onFeatureClick: (feature: any, layer: any) => void;
  currentLayer: any;
  activeFeature: any;
  compassVisible: boolean;
  gridVisible: boolean;
  showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
}

// Parse matrix transform -> translate
function parseTranslateFromTransform(transform: string) {
  if (!transform || transform === 'none') return { tx: 0, ty: 0 };
  if (transform.startsWith('matrix3d')) {
    const parts = transform.replace('matrix3d(', '').replace(')', '').split(',').map(p => parseFloat(p.trim()));
    return { tx: parts[17] || 0, ty: parts[18] || 0 };
  }
  if (transform.startsWith('matrix')) {
    const parts = transform.replace('matrix(', '').replace(')', '').split(',').map(p => parseFloat(p.trim()));
    return { tx: parts[19] || 0, ty: parts[20] || 0 };
  }
  return { tx: 0, ty: 0 };
}

// Collect GeoJSON from active overlay + drawn features
function collectMapGeoJSON(map: any, geoJsonLayer: any, drawnItems: any) {
  require('leaflet');
  const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] as GeoJSON.Feature[] };
  if (geoJsonLayer?.toGeoJSON) {
    const gj = geoJsonLayer.toGeoJSON();
    if (gj?.type === 'FeatureCollection') fc.features.push(...(gj.features as any));
    else if (gj?.type === 'Feature') fc.features.push(gj as any);
  }
  if (drawnItems && typeof drawnItems.eachLayer === 'function') {
    drawnItems.eachLayer((layer: any) => {
      if (layer?.toGeoJSON) {
        const gj = layer.toGeoJSON();
        if (gj?.type === 'FeatureCollection') fc.features.push(...(gj.features as any));
        else if (gj?.type === 'Feature') fc.features.push(gj as any);
      }
    });
  }
  return { type: 'FeatureCollection', features: fc.features };
}

// Download helper (GeoJSON by default)
function downloadTextFile(filename: string, text: string, mime = 'application/geo+json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// PDF export with heading/DPI/size/orientation
async function exportMapToPDF(opts: {
  mapEl: HTMLElement;
  mapInstance: any;
  heading: string;
  qualityDPI: number;
  pageFormat: 'a4' | 'a3';
  orientation: 'portrait' | 'landscape';
  currentBasemapId?: string;
}) {
  const { mapEl, mapInstance, heading, qualityDPI, pageFormat, orientation, currentBasemapId } = opts;

  const bounds = mapInstance.getBounds();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const scale = Math.max(1, qualityDPI / 96) * dpr;

  const overlayRoot = mapEl.parentElement;
  const uiOverlays = Array.from(overlayRoot?.querySelectorAll('.pointer-events-auto') ?? []) as HTMLElement[];
  uiOverlays.forEach(el => (el.style.visibility = 'hidden'));

  const origDragging = mapInstance.dragging.enabled();
  const origScrollZoom = mapInstance.scrollWheelZoom.enabled();
  const origBoxZoom = mapInstance.boxZoom.enabled();
  const origDoubleClickZoom = mapInstance.doubleClickZoom.enabled();
  mapInstance.dragging.disable();
  mapInstance.scrollWheelZoom.disable();
  mapInstance.boxZoom.disable();
  mapInstance.doubleClickZoom.disable();

  const mapPane = mapEl.querySelector('.leaflet-map-pane') as HTMLElement | null;
  const tilePane = mapEl.querySelector('.leaflet-tile-pane') as HTMLElement | null;
  const objectsPane = mapEl.querySelector('.leaflet-objects-pane') as HTMLElement | null;
  const markerPane = mapEl.querySelector('.leaflet-marker-pane') as HTMLElement | null;
  const overlayPane = mapEl.querySelector('.leaflet-overlay-pane') as HTMLElement | null;
  const shadowPane = mapEl.querySelector('.leaflet-shadow-pane') as HTMLElement | null;

  const panes: HTMLElement[] = [mapPane, tilePane, objectsPane, markerPane, overlayPane, shadowPane].filter(Boolean) as HTMLElement[];
  const saved: Array<{ el: HTMLElement; transform: string; left: string; top: string }> = [];

  const normalizeTransform = (el: HTMLElement) => {
    const computed = getComputedStyle(el);
    const transform = computed.transform || 'none';
    const { tx, ty } = parseTranslateFromTransform(transform);
    saved.push({ el, transform: el.style.transform, left: el.style.left, top: el.style.top });
    el.style.transform = 'none';
    const curLeft = parseFloat((el.style.left || '0').replace('px', '')) || 0;
    const curTop = parseFloat((el.style.top || '0').replace('px', '')) || 0;
    el.style.left = `${curLeft + tx}px`;
    el.style.top = `${curTop + ty}px`;
  };

  panes.forEach(normalizeTransform);

  mapInstance.invalidateSize();
  await new Promise(res => setTimeout(res, 300));

  const canvas = await html2canvas(mapEl, {
    scale,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    ignoreElements: (element) => element.classList?.contains('pointer-events-auto') || false,
    foreignObjectRendering: false
  });

  saved.forEach(({ el, transform, left, top }) => {
    el.style.transform = transform;
    el.style.left = left;
    el.style.top = top;
  });

  if (origDragging) mapInstance.dragging.enable();
  if (origScrollZoom) mapInstance.scrollWheelZoom.enable();
  if (origBoxZoom) mapInstance.boxZoom.enable();
  if (origDoubleClickZoom) mapInstance.doubleClickZoom.enable();

  uiOverlays.forEach(el => (el.style.visibility = ''));

  const doc = new jsPDF({
    orientation,
    unit: 'pt',
    format: pageFormat
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const margin = 50;
  const headerHeight = 50;
  const bottomSpace = 80;
  const coordinateMargin = 25;

  const imgWpx = canvas.width;
  const imgHpx = canvas.height;
  const imgAspect = imgWpx / imgHpx;

  const frameLeft = margin + coordinateMargin;
  const frameTop = margin + headerHeight + coordinateMargin;
  const frameW = pageW - (margin + coordinateMargin) * 2;
  const frameH = pageH - frameTop - margin - bottomSpace - coordinateMargin;

  let drawW = frameW;
  let drawH = drawW / imgAspect;
  if (drawH > frameH) {
    drawH = frameH;
    drawW = drawH * imgAspect;
  }
  const imgX = frameLeft + (frameW - drawW) / 2;
  const imgY = frameTop + (frameH - drawH) / 2;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(heading || 'Map Export', pageW / 2, margin + 25, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`${currentDate}`, pageW / 2, margin + 40, { align: 'center' });

  const imgData = canvas.toDataURL('image/png', 0.95);
  doc.addImage(imgData, 'PNG', imgX, imgY, drawW, drawH);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.rect(frameLeft, frameTop, frameW, frameH);

  const arcMapCoordinates = calculateArcMapCoordinates(bounds, frameW, frameH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  arcMapCoordinates.forEach(coord => {
    const x = frameLeft + coord.x;
    const y = frameTop + coord.y;
    let text = '';
    let textAlign: 'left' | 'center' | 'right' = 'center';
    let angle = 0;
    if (coord.position === 'top' || coord.position === 'bottom') {
      text = formatLongitude(coord.lng);
      textAlign = 'center';
    } else {
      text = formatLatitude(coord.lat);
      textAlign = 'center';
      angle = coord.position === 'left' ? -90 : 90;
    }
    doc.text(text, x, y, { align: textAlign, angle });
    if (coord.position === 'top') doc.line(x, frameTop, x, frameTop - 5);
    else if (coord.position === 'bottom') doc.line(x, frameTop + frameH, x, frameTop + frameH + 5);
    else if (coord.position === 'left') doc.line(frameLeft, y, frameLeft - 5, y);
    else if (coord.position === 'right') doc.line(frameLeft + frameW, y, frameLeft + frameW + 5, y);
  });

  const belowMapY = frameTop + frameH + 20;
  const compassX = frameLeft + 30;
  const compassY = belowMapY + 15;

  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.line(compassX, compassY - 15, compassX, compassY + 5);
  const ax = compassX;
  const ay = compassY - 15;
  const leftX = compassX - 4;
  const leftY = compassY - 8;
  const rightX = compassX + 4;
  const rightY = compassY - 8;
  doc.line(compassX, compassY - 15, compassX, compassY + 5);
  doc.lines(
    [
      [leftX - ax, leftY - ay],
      [rightX - leftX, rightY - leftY],
      [ax - rightX, ay - rightY],
    ],
    ax,
    ay,
    [1, 1],
    'F'
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('N', compassX, compassY - 20, { align: 'center' });

  const scaleBarX = frameLeft + 100;
  const scaleBarY = belowMapY + 10;
  const scaleBarWidth = 100;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.line(scaleBarX, scaleBarY, scaleBarX + scaleBarWidth, scaleBarY);
  const divisions = 5;
  for (let i = 0; i <= divisions; i++) {
    const divX = scaleBarX + (scaleBarWidth / divisions) * i;
    const tickHeight = i % 2 === 0 ? 6 : 3;
    doc.line(divX, scaleBarY, divX, scaleBarY - tickHeight);
    doc.setFontSize(8);
    if (i === 0) doc.text('0', divX, scaleBarY + 12, { align: 'center' });
    else if (i === divisions) doc.text('km', divX, scaleBarY + 12, { align: 'center' });
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Scale', scaleBarX + scaleBarWidth / 2, scaleBarY + 20, { align: 'center' });

  const infoX = frameLeft + frameW - 50;
  const infoY = belowMapY;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const center = bounds.getCenter();
  const centerText = `Center: ${formatLatitude(center.lat)}, ${formatLongitude(center.lng)}`;
  doc.text(centerText, infoX, infoY + 10, { align: 'right' });
  if (currentBasemapId) {
    const basemapText = `Basemap: ${currentBasemapId.charAt(0).toUpperCase() + currentBasemapId.slice(1)}`;
    doc.text(basemapText, infoX, infoY + 22, { align: 'right' });
  }
  const timestamp = new Date().toLocaleString();
  doc.text(`Generated: ${timestamp}`, infoX, infoY + 44, { align: 'right' });

  doc.save(`map_export_${pageFormat}_${orientation}.pdf`);
}

function calculateArcMapCoordinates(bounds: any, frameW: number, frameH: number) {
  const nw = bounds.getNorthWest();
  const ne = bounds.getNorthEast();
  const se = bounds.getSouthEast();
  const sw = bounds.getSouthWest();

  const minSpacing = 50;
  const maxLabels = 12;

  const topLabelsCount = Math.min(maxLabels, Math.max(3, Math.floor(frameW / minSpacing)));
  const rightLabelsCount = Math.min(maxLabels, Math.max(3, Math.floor(frameH / minSpacing)));
  const bottomLabelsCount = Math.min(maxLabels, Math.max(3, Math.floor(frameW / minSpacing)));
  const leftLabelsCount = Math.min(maxLabels, Math.max(3, Math.floor(frameH / minSpacing)));

  const coordinates: Array<{ x: number; y: number; lat: number; lng: number; position: 'top' | 'right' | 'bottom' | 'left' }> = [];

  for (let i = 0; i <= topLabelsCount; i++) {
    const ratio = i / topLabelsCount;
    const lng = nw.lng + (ne.lng - nw.lng) * ratio;
    const lat = nw.lat;
    coordinates.push({ x: ratio * frameW, y: -15, lat, lng, position: 'top' });
  }

  for (let i = 0; i <= rightLabelsCount; i++) {
    const ratio = i / rightLabelsCount;
    const lat = ne.lat + (se.lat - ne.lat) * ratio;
    const lng = ne.lng;
    coordinates.push({ x: frameW + 50, y: ratio * frameH + 8, lat, lng, position: 'right' });
  }

  for (let i = 0; i <= bottomLabelsCount; i++) {
    const ratio = i / bottomLabelsCount;
    const lng = sw.lng + (se.lng - sw.lng) * ratio;
    const lat = sw.lat;
    coordinates.push({ x: ratio * frameW, y: frameH + 15, lat, lng, position: 'bottom' });
  }

  for (let i = 0; i <= leftLabelsCount; i++) {
    const ratio = i / leftLabelsCount;
    const lat = nw.lat + (sw.lat - nw.lat) * ratio;
    const lng = nw.lng;
    coordinates.push({ x: -8, y: ratio * frameH - 5, lat, lng, position: 'left' });
  }

  return coordinates;
}

function formatLatitude(lat: number): string {
  const dir = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(4)}°${dir}`;
}
function formatLongitude(lng: number): string {
  const dir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lng).toFixed(4)}°${dir}`;
}

export default function Map(props: MapProps) {
  const { sidebarCollapsed, onFeatureClick, currentLayer, activeFeature, compassVisible, gridVisible, showNotification } = props;

  const [geoJsonLayer, setGeoJsonLayer] = useState<any>(null);
  const [uploadedLayer, setUploadedLayer] = useState<any>(null);
  const [coordinates, setCoordinates] = useState({ lat: 0, lng: 0 });
  const [loading, setLoading] = useState(false);
  const [bufferDistance, setBufferDistance] = useState(100);
  const [bufferToolVisible, setBufferToolVisible] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [currentBasemap, setCurrentBasemap] = useState('traffic');
  const [mapReady, setMapReady] = useState(false);

  // Export modal form state
  const [pdfHeading, setPdfHeading] = useState('Map Export');
  const [pdfDPI, setPdfDPI] = useState<number>(200);
  const [pdfFormat, setPdfFormat] = useState<'a4' | 'a3'>('a4');
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('landscape');

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const drawnItemsRef = useRef<any>(null);
  const baseLayersRef = useRef<{ [key: string]: any }>({});
  const currentBaseLayerRef = useRef<any>(null);

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

      L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

      const drawnItems = new L.FeatureGroup(undefined as any, { renderer: L.canvas() } as any);
      map.addLayer(drawnItems);
      drawnItemsRef.current = drawnItems;

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
        },
        edit: { featureGroup: drawnItems, remove: true },
      });
      map.addControl(drawControl);

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
          drawnItems.addLayer(layer);
          drawnItems.eachLayer((l: any) => { l._selected = false; });
          layer._selected = true;

          if (layer instanceof L.Polygon) {
            const latlngs: any[] = (layer.getLatLngs() as any[]).flat(2);
            let area = 0;
            for (let i = 0; i < latlngs.length; i++) {
              const j = (i + 1) % latlngs.length;
              area += latlngs[i].lng * latlngs[j].lat;
              area -= latlngs[j].lng * latlngs[i].lat;
            }
            area = Math.abs(area) * 0.5 * 111.32 * 111.32;
            layer.bindPopup(`<strong>Area:</strong> ${area.toFixed(2)} sq km`).openPopup();
          }
        } catch { /* noop */ }
      });

      map.on('error', () => { /* noop */ });

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

      return () => {
        window.removeEventListener('resize', handleResize);
        setMapReady(false);
        if (mapInstanceRef.current) {
          try { mapInstanceRef.current.remove(); } catch { /* noop */ }
          mapInstanceRef.current = null;
        }
      };
    };

    return () => clearTimeout(initTimer);
  }, [initializeLeaflet, createBaseLayers, currentBasemap, showNotification]);

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

  const loadGeoJSON = useCallback(async (category: string, subcategory: string) => {
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

      const response = await fetch(`/django/get_shapefile?category=${category}&subcategory=${subcategory}`);
      if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`);

      const geoJsonData = await response.json();
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

      const lineColorElement = document.getElementById('lineColor') as HTMLInputElement | null;
      const weightElement = document.getElementById('weight') as HTMLInputElement | null;
      const fillColorElement = document.getElementById('fillColor') as HTMLInputElement | null;
      const opacityElement = document.getElementById('opacity') as HTMLInputElement | null;

      const lineColor = lineColorElement?.value || 'red';
      const weight = parseInt(weightElement?.value || '2', 10);
      const fillColor = fillColorElement?.value || '#78b4db';
      const opacity = parseFloat(opacityElement?.value || '0.1');

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
      showNotification('Success', 'Vector data loaded successfully', 'success');
      return newLayer;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      showNotification('Error', `Failed to load data: ${message}`, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [geoJsonLayer, uploadedLayer, onFeatureClick, showNotification]);

  const updateLayerStyles = useCallback(() => {
    if (!geoJsonLayer && !uploadedLayer) return;
    const lineColor = (document.getElementById('lineColor') as HTMLInputElement | null)?.value || '#000000';
    const weight = parseInt((document.getElementById('weight') as HTMLInputElement | null)?.value || '2', 10);
    const fillColor = (document.getElementById('fillColor') as HTMLInputElement | null)?.value || '#78b4db';
    const fillOpacity = parseFloat((document.getElementById('opacity') as HTMLInputElement | null)?.value || '0.1');

    if (geoJsonLayer) geoJsonLayer.setStyle({ color: lineColor, weight, opacity: 1, fillColor, fillOpacity });
    if (uploadedLayer) uploadedLayer.setStyle({ color: lineColor, weight, opacity: 1, fillColor, fillOpacity });
  }, [geoJsonLayer, uploadedLayer]);

  // Upload shapefile handler
  const uploadShapefile = useCallback(async (files: FileList) => {
    const acceptExt = ['.zip', '.shp', '.shx', '.dbf', '.prj', '.cpg'];
    
    const validateFiles = (files: FileList | null) => {
      if (!files || files.length === 0) return { ok: false, reason: 'No file selected' };
      const names = Array.from(files).map(f => f.name.toLowerCase());
      const hasZip = names.some(n => n.endsWith('.zip'));
      const hasShp = names.some(n => n.endsWith('.shp'));
      const allAllowed = names.every(n => acceptExt.some(ext => n.endsWith(ext)));
      if (!allAllowed) return { ok: false, reason: 'Wrong format. Upload a .zip or the .shp with sidecar files (.shx, .dbf, .prj, .cpg).' };
      if (!hasZip && !hasShp) return { ok: false, reason: 'No .zip or .shp found. Select a zipped shapefile or include at least the .shp file.' };
      return { ok: true, reason: '' };
    };

    const valid = validateFiles(files);
    if (!valid.ok) {
      showNotification('Wrong Format', valid.reason, 'error');
      return null;
    }

    try {
      const form = new FormData();
      Array.from(files).forEach(f => form.append('file', f));
      
      const res = await fetch('/django/upload-shapefile', {
        method: 'POST',
        body: form,
      });
      
      const ctype = res.headers.get('content-type') || '';
      if (!res.ok) {
        if (ctype.includes('application/json')) {
          const err = await res.json();
          throw new Error(err?.error || `Upload failed (${res.status})`);
        }
        throw new Error(`Upload failed (${res.status})`);
      }
      
      const payload = await res.json();
      const geojson = typeof payload === 'string' ? JSON.parse(payload) : payload;
      
      if (!geojson || !geojson.features || !Array.isArray(geojson.features) || geojson.features.length === 0) {
        showNotification('Error', 'No features in uploaded data', 'error');
        return null;
      }

      // Plot on map
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
      return geojson;
    } catch (e: any) {
      showNotification('Error', e?.message || 'Upload failed', 'error');
      return null;
    }
  }, [geoJsonLayer, uploadedLayer, onFeatureClick, showNotification]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.changeBasemap = changeBasemap;
      window.loadGeoJSON = loadGeoJSON;
      window.updateMapStyles = updateLayerStyles;
      window.toggleBufferTool = () => setBufferToolVisible((prev) => !prev);
      window.uploadShapefile = uploadShapefile;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.changeBasemap;
        delete window.loadGeoJSON;
        delete window.updateMapStyles;
        delete window.toggleBufferTool;
        delete window.uploadShapefile;
      }
    };
  }, [changeBasemap, loadGeoJSON, updateLayerStyles, uploadShapefile]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 300);
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const compass = document.getElementById('compass');
    if (compass) {
      compass.style.display = compassVisible ? 'flex' : 'none';
    }
  }, [compassVisible]);

  useEffect(() => {
    if (!currentLayer || !activeFeature) return;
    const L = require('leaflet');

    currentLayer.eachLayer((layer: any) => {
      if (layer !== activeFeature) {
        if (layer instanceof L.Path) currentLayer.resetStyle(layer);
        if (layer instanceof L.Marker && layer._highlightCircle) {
          mapInstanceRef.current?.removeLayer(layer._highlightCircle);
          delete layer._highlightCircle;
        }
      }
    });

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
    } else if (activeFeature instanceof (require('leaflet').Path)) {
      activeFeature.setStyle({ weight: 3, color: '#ff4444', fillOpacity: 0.7 });
    }

    return () => {
      if ((activeFeature as any)?._highlightCircle) {
        mapInstanceRef.current?.removeLayer((activeFeature as any)._highlightCircle);
        delete (activeFeature as any)._highlightCircle;
      }
    };
  }, [activeFeature, currentLayer]);

  const handleHomeClick = () => {
    mapInstanceRef.current?.setView([22.3511, 78.6677], 5);
    showNotification('Map Reset', 'Returned to default view', 'info');
  };
  
  const handleLocateClick = () => {
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
  };
  
  const handleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen?.();
    }
  };
  
  const createBuffer = () => {
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
      }
      showNotification('Buffer Created', `${bufferDistance}m buffer created`, 'success');
    } catch {
      showNotification('Buffer Error', 'Failed to create buffer', 'error');
    }
  };

  const waitForAllLayersReady = async (map: any, timeoutMs = 6000) => {
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const allLayers: any[] = [];
      map.eachLayer((layer: any) => { allLayers.push(layer); });
      const tileLayers = allLayers.filter(layer => layer._tiles || typeof layer.getTileUrl === 'function');
      if (tileLayers.length === 0) {
        setTimeout(finish, 200);
        return;
      }
      const allTilesComplete = () => {
        return tileLayers.every((layer) => {
          const tiles = layer._tiles;
          if (!tiles) return true;
          const keys = Object.keys(tiles);
          if (keys.length === 0) return false;
          return keys.every((k) => {
            const tile = tiles[k];
            const img: HTMLImageElement | undefined = tile?.el || tile;
            return img && (img as any).complete;
          });
        });
      };
      const poll = setInterval(() => {
        if (allTilesComplete()) {
          clearInterval(poll);
          clearTimeout(safety);
          finish();
        }
      }, 120);
      const safety = setTimeout(() => {
        clearInterval(poll);
        finish();
      }, timeoutMs);
    });
  };

  const handleExportPDF = async () => {
    if (!mapInstanceRef.current) {
      showNotification('Error', 'Map not initialized', 'error');
      return;
    }
    const mapEl = mapRef?.current ?? mapInstanceRef.current?._container;
    if (!mapEl) {
      showNotification('Error', 'Map container not found', 'error');
      return;
    }

    setExportModalOpen(false);
    showNotification('Info', 'Preparing map for export...', 'info');

    try {
      await waitForAllLayersReady(mapInstanceRef.current, 7000);
      await new Promise(res => setTimeout(res, 200));
      await exportMapToPDF({
        mapEl,
        mapInstance: mapInstanceRef.current,
        heading: pdfHeading,
        qualityDPI: Math.max(72, Math.min(600, Number(pdfDPI) || 200)),
        pageFormat: pdfFormat,
        orientation: pdfOrientation,
        currentBasemapId: currentBasemap,
      });
      showNotification('Success', 'Map exported successfully!', 'success');
    } catch (err) {
      console.log('PDF export error:', err);
      showNotification('Error', 'PDF export failed. Please try again.', 'error');
    }
  };

  const handleExportGeoJSON = () => {
    try {
      if (!mapInstanceRef.current) {
        showNotification('Error', 'Map not initialized', 'error');
        return;
      }
      const fc = collectMapGeoJSON(mapInstanceRef.current, geoJsonLayer || uploadedLayer, drawnItemsRef.current);
      if (!fc.features.length) {
        showNotification('Info', 'No features to export', 'info');
        return;
      }
      const pretty = JSON.stringify(fc, null, 2);
      downloadTextFile('map_features.geojson', pretty, 'application/geo+json');
      setExportModalOpen(false);
      showNotification('Success', 'GeoJSON exported', 'success');
    } catch (e) {
      showNotification('Error', 'Failed to export GeoJSON', 'error');
    }
  };

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapRef}
        data-map-root
        className="absolute inset-0 w-full h-full rounded-lg shadow-inner z-0"
        style={{ minHeight: '400px', minWidth: '300px', backgroundColor: '#f0f0f0' }}
      />
      <div className="absolute inset-0 z-10 pointer-events-none">
        <div className="absolute bottom-1 left-28 bg-white/90 py-1 px-3 rounded-lg shadow-md backdrop-blur-sm text-sm pointer-events-auto">
          <span className="font-medium text-gray-700">Lat: {coordinates.lat} | Lng: {coordinates.lng}</span>
        </div>

        {compassVisible && (
          <div id="compass" className="absolute top-10 left-10 w-24 h-24 pointer-events-auto">
            <img src="/compas.png" alt="Compass" className="w-full h-full object-contain drop-shadow-md" />
          </div>
        )}

        {/* Right tool strip */}
        <div className="absolute bottom-8 right-4 bg-white rounded-xl shadow-md flex flex-col p-1 pointer-events-auto">
          <button onClick={() => mapInstanceRef.current?.zoomIn()} className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors" title="Zoom In">
            <i className="fas fa-plus"></i>
          </button>
          <button onClick={() => mapInstanceRef.current?.zoomOut()} className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors" title="Zoom Out">
            <i className="fas fa-minus"></i>
          </button>
          <button onClick={handleHomeClick} className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors" title="Home">
            <i className="fas fa-home"></i>
          </button>
          <button onClick={handleLocateClick} className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors" title="Locate">
            <i className="fas fa-location-arrow"></i>
          </button>
          <button onClick={handleFullScreen} className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors" title="Fullscreen">
            <i className="fas fa-expand"></i>
          </button>
          <button onClick={() => setBufferToolVisible(!bufferToolVisible)} className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors" title="Buffer Tool">
            <i className="fas fa-circle-notch"></i>
          </button>
          <button
            onClick={() => setExportModalOpen(true)}
            className="w-10 h-10 hover:bg-rose-500 hover:text-white rounded-lg flex items-center justify-center transition-colors"
            title="Export"
            aria-label="Export"
          >
            <i className="fas fa-file-export"></i>
          </button>
        </div>

        {/* Buffer Tool */}
        {bufferToolVisible && (
          <div className="absolute top-32 right-4 bg-white rounded-xl shadow-md p-4 w-64 pointer-events-auto">
            <h3 className="font-medium mb-2">Buffer Tool</h3>
            <div className="mb-3">
              <label className="block text-sm mb-1">Distance (m)</label>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={bufferDistance}
                onChange={(e) => setBufferDistance(parseInt(e.target.value, 10))}
                className="w-full"
              />
              <div className="text-center text-sm font-medium text-blue-600">{bufferDistance}m</div>
            </div>
            <button onClick={createBuffer} className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors">
              Create Buffer
            </button>
          </div>
        )}

        {/* Export modal with PDF options and GeoJSON */}
        {exportModalOpen && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
            <div className="fixed inset-0 bg-black/40" onClick={() => setExportModalOpen(false)} />
            <div className="relative z-10 bg-white rounded-xl shadow-xl p-5 w-[min(480px,calc(100vw-2rem))]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Export</h3>
                <button
                  onClick={() => setExportModalOpen(false)}
                  className="text-gray-500 hover:text-gray-800"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1">Heading</label>
                    <input
                      type="text"
                      value={pdfHeading}
                      onChange={(e) => setPdfHeading(e.target.value)}
                      className="w-full border rounded-md px-2 py-1 text-sm"
                      placeholder="Map Export"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">DPI</label>
                    <input
                      type="number"
                      min={72}
                      max={600}
                      value={pdfDPI}
                      onChange={(e) => setPdfDPI(parseInt(e.target.value || '200', 10))}
                      className="w-full border rounded-md px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Paper Size</label>
                    <select
                      value={pdfFormat}
                      onChange={(e) => setPdfFormat(e.target.value as 'a4' | 'a3')}
                      className="w-full border rounded-md px-2 py-1 text-sm"
                    >
                      <option value="a4">A4</option>
                      <option value="a3">A3</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Orientation</label>
                    <select
                      value={pdfOrientation}
                      onChange={(e) => setPdfOrientation(e.target.value as 'portrait' | 'landscape')}
                      className="w-full border rounded-md px-2 py-1 text-sm"
                    >
                      <option value="landscape">Landscape</option>
                      <option value="portrait">Portrait</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleExportPDF}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Export PDF
                  </button>
                  <button
                    onClick={handleExportGeoJSON}
                    className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Export GeoJSON
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {(loading || !mapReady) && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/95 py-3 px-4 sm:py-4 sm:px-6 rounded-lg shadow-md flex items-center pointer-events-auto max-w-[calc(100vw-2rem)]">
            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2 sm:mr-3"></div>
            <span className="text-sm sm:text-base">{!mapReady ? 'Initializing map...' : 'Loading vector data...'}</span>
          </div>
        )}
      </div>
    </div>
  );
}