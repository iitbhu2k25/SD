// app/vector/components/ExportModal.tsx
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { exportMapPNG, exportMapPDFServer, geojsonToShapefile } from '../services/api.service';


interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapRef: React.RefObject<HTMLDivElement>;
  mapInstance: any;
  managedLayers: Array<{
    id: string;
    name: string;
    layer: any;
    visible: boolean;
    type: 'geojson' | 'uploaded' | 'drawn';
  }>;
  drawnItems: any;
  currentBasemap: string;
  showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
}


function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Parse matrix transform -> translate
function parseTranslateFromTransform(transform: string) {
  if (!transform || transform === 'none') return { tx: 0, ty: 0 };
  if (transform.startsWith('matrix3d')) {
    const parts = transform.replace('matrix3d(', '').replace(')', '').split(',').map(p => parseFloat(p.trim()));
    return { tx: parts[12] || 0, ty: parts[13] || 0 };
  }
  if (transform.startsWith('matrix')) {
    const parts = transform.replace('matrix(', '').replace(')', '').split(',').map(p => parseFloat(p.trim()));
    return { tx: parts[4] || 0, ty: parts[5] || 0 };
  }
  return { tx: 0, ty: 0 };
}

function collectMapGeoJSON(map: any, managedLayers: any[], drawnItems: any) {
  const fc: GeoJSON.FeatureCollection = { 
    type: 'FeatureCollection', 
    features: [] as GeoJSON.Feature[] 
  };

  console.log('Collecting GeoJSON from:', { managedLayers: managedLayers.length, drawnItems: !!drawnItems });

  // Collect from managed layers
  managedLayers.forEach(ml => {
    if (ml.layer && ml.visible && ml.layer.toGeoJSON) {
      try {
        const gj = ml.layer.toGeoJSON();
        if (gj?.type === 'FeatureCollection') {
          const features = gj.features.map((f: any) => {
            console.log('Feature properties:', f.properties);
            return {
              ...f,
              properties: f.properties || {}
            };
          });
          fc.features.push(...features);
        } else if (gj?.type === 'Feature') {
          console.log('Single feature properties:', gj.properties);
          fc.features.push({
            ...gj,
            properties: gj.properties || {}
          } as any);
        }
      } catch (e) {
        console.warn('Failed to convert layer to GeoJSON:', e);
      }
    }
  });

  // Collect from drawn items
  if (drawnItems && typeof drawnItems.eachLayer === 'function') {
    drawnItems.eachLayer((layer: any) => {
      if (layer?.toGeoJSON) {
        try {
          const gj = layer.toGeoJSON();
          console.log('Drawn feature GeoJSON:', gj);
          if (gj?.type === 'FeatureCollection') {
            const features = gj.features.map((f: any) => ({
              ...f,
              properties: f.properties || {}
            }));
            fc.features.push(...features);
          } else if (gj?.type === 'Feature') {
            fc.features.push({
              ...gj,
              properties: gj.properties || {}
            } as any);
          }
        } catch (e) {
          console.warn('Failed to convert drawn layer to GeoJSON:', e);
        }
      }
    });
  }
  
  console.log('Total features collected:', fc.features.length);
  console.log('Final GeoJSON:', JSON.stringify(fc, null, 2));
  
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
    coordinates.push({ x: ratio * frameW, y: -20, lat, lng, position: 'top' });
  }

  for (let i = 0; i <= rightLabelsCount; i++) {
    const ratio = i / rightLabelsCount;
    const lat = ne.lat + (se.lat - ne.lat) * ratio;
    const lng = ne.lng;
    //coordinates.push({ x: frameW + 50, y: ratio * frameH + 8, lat, lng, position: 'right' });
    coordinates.push({ x: frameW + 50, y: ratio * frameH + 16, lat, lng, position: 'right' });
  }

  for (let i = 0; i <= bottomLabelsCount; i++) {
    const ratio = i / bottomLabelsCount;
    const lng = sw.lng + (se.lng - sw.lng) * ratio;
    const lat = sw.lat;
    coordinates.push({ x: ratio * frameW, y: frameH + 20, lat, lng, position: 'bottom' });
  }

  for (let i = 0; i <= leftLabelsCount; i++) {
    const ratio = i / leftLabelsCount;
    const lat = nw.lat + (sw.lat - nw.lat) * ratio;
    const lng = nw.lng;
    //coordinates.push({ x: -8, y: ratio * frameH - 5, lat, lng, position: 'left' });
    coordinates.push({ x: -12, y: ratio * frameH - 22, lat, lng, position: 'left' });
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
    backgroundColor: '#14a2b7',
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
  const coordinateMargin = 20;

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
  doc.setFont('Inconsolata', 'bold');
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

export default function ExportModal({
  isOpen,
  onClose,
  mapRef,
  mapInstance,
  managedLayers,
  drawnItems,
  currentBasemap,
  showNotification,
}: ExportModalProps) {
  const [pdfHeading, setPdfHeading] = useState('Map Export');
  const [pdfDPI, setPdfDPI] = useState<number>(200);
  const [pdfFormat, setPdfFormat] = useState<'a4' | 'a3'>('a4');
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [exportType, setExportType] = useState<'client' | 'server'>('client');
  const [pngWidth, setPngWidth] = useState<number>(1920);
  const [pngHeight, setPngHeight] = useState<number>(1080);
  const [pngDPI, setPngDPI] = useState<number>(300);
  const [shapefileName, setShapefileName] = useState<string>('map_export');
  const [exporting, setExporting] = useState(false);



  const handleExportPDF = async () => {
    if (!mapInstance) {
      showNotification('Error', 'Map not initialized', 'error');
      return;
    }
    const mapEl = mapRef?.current ?? mapInstance?._container;
    if (!mapEl) {
      showNotification('Error', 'Map container not found', 'error');
      return;
    }

    onClose();
    showNotification('Info', 'Preparing map for export...', 'info');

    try {
      await waitForAllLayersReady(mapInstance, 7000);
      await new Promise(res => setTimeout(res, 200));



      // Get map bounds and center
      const bounds = mapInstance.getBounds();
      const center = mapInstance.getCenter();
      // Calculate available space for map
      const doc = new jsPDF({
        orientation: pdfOrientation,
        unit: 'pt',
        format: pdfFormat,
      });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 50;
      const headerHeight = 50;
      const bottomSpace = 80;
      const coordinateMargin = 25;

      const frameLeft = margin + coordinateMargin;
      const frameTop = margin + headerHeight + coordinateMargin;
      const maxFrameW = pageW - (margin + coordinateMargin) * 2;
      const maxFrameH = pageH - frameTop - margin - bottomSpace - coordinateMargin;

      // Use html2canvas to capture the actual Leaflet map
      const scale = Math.max(1, pdfDPI / 96);
      
      // Hide UI overlays
      const overlayRoot = mapEl.parentElement;
      const uiOverlays = Array.from(overlayRoot?.querySelectorAll('.pointer-events-auto') ?? []) as HTMLElement[];
      uiOverlays.forEach(el => (el.style.visibility = 'hidden'));

      // Disable map interactions
      const origDragging = mapInstance.dragging.enabled();
      const origScrollZoom = mapInstance.scrollWheelZoom.enabled();
      const origBoxZoom = mapInstance.boxZoom.enabled();
      const origDoubleClickZoom = mapInstance.doubleClickZoom.enabled();
      mapInstance.dragging.disable();
      mapInstance.scrollWheelZoom.disable();
      mapInstance.boxZoom.disable();
      mapInstance.doubleClickZoom.disable();

      // Capture map with html2canvas
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(mapEl, {
        scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        ignoreElements: (element) => element.classList?.contains('pointer-events-auto') || false,
        foreignObjectRendering: false
      });

      // Restore map interactions
      if (origDragging) mapInstance.dragging.enable();
      if (origScrollZoom) mapInstance.scrollWheelZoom.enable();
      if (origBoxZoom) mapInstance.boxZoom.enable();
      if (origDoubleClickZoom) mapInstance.doubleClickZoom.enable();
      uiOverlays.forEach(el => (el.style.visibility = ''));

      // Convert canvas to image data
      const imgData = canvas.toDataURL('image/png', 0.95);

      // Calculate actual image dimensions to fit frame exactly
      const canvasAspect = canvas.width / canvas.height;
      const frameAspect = maxFrameW / maxFrameH;

      let finalW = maxFrameW;
      let finalH = maxFrameH;
      
      if (canvasAspect > frameAspect) {
        // Image is wider than frame
        finalH = maxFrameW / canvasAspect;
      } else {
        // Image is taller than frame
        finalW = maxFrameH * canvasAspect;
      }

      const imgX = frameLeft + (maxFrameW - finalW) / 2;
      const imgY = frameTop + (maxFrameH - finalH) / 2;

      // Add PDF content
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(pdfHeading || 'Map Export', pageW / 2, margin + 25, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`${currentDate}`, pageW / 2, margin + 40, { align: 'center' });

      // Add map image
      doc.addImage(imgData, 'PNG', imgX, imgY, finalW, finalH);

      // Draw border around the actual image (not the frame)
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1);
      doc.rect(imgX, imgY, finalW, finalH);

      // Add coordinate labels around the actual image
      const arcMapCoordinates = calculateArcMapCoordinates(bounds, finalW, finalH);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      
      arcMapCoordinates.forEach(coord => {
        const x = imgX + coord.x;
        const y = imgY + coord.y;
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
        
        if (coord.position === 'top') doc.line(x, imgY, x, imgY - 5);
        else if (coord.position === 'bottom') doc.line(x, imgY + finalH, x, imgY + finalH + 5);
        else if (coord.position === 'left') doc.line(imgX, y, imgX - 10, y);
        else if (coord.position === 'right') doc.line(imgX + finalW, y, imgX + finalW + 5, y);
      });

      // Add north arrow, scale, and metadata
      const belowMapY = imgY + finalH + 20;
      const compassX = imgX + 30;
      const compassY = belowMapY + 15;

      // North arrow
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

      // Scale bar
      const scaleBarX = imgX + 100;
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

      // Map info
      const infoX = imgX + finalW - 50;
      const infoY = belowMapY;
      
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const centerText = `Center: ${formatLatitude(center.lat)}, ${formatLongitude(center.lng)}`;
      doc.text(centerText, infoX, infoY + 10, { align: 'right' });
      
      if (currentBasemap) {
        const basemapText = `Basemap: ${currentBasemap.charAt(0).toUpperCase() + currentBasemap.slice(1)}`;
        doc.text(basemapText, infoX, infoY + 22, { align: 'right' });
      }
      
      const timestamp = new Date().toLocaleString();
      doc.text(`Generated: ${timestamp}`, infoX, infoY + 44, { align: 'right' });

      // Save PDF
      doc.save(`map_export_${pdfFormat}_${pdfOrientation}.pdf`);
      
      showNotification('Success', 'Map exported successfully!', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      showNotification('Error', 'PDF export failed. Please try again.', 'error');
    }
  };

  const handleExportPDFServer = async () => {
    if (!mapInstance) {
      showNotification('Error', 'Map not initialized', 'error');
      return;
    }

    try {
      setExporting(true);
      onClose();
      showNotification('Info', 'Preparing PDF export from server...', 'info');

      // Collect GeoJSON
      const geojson = collectMapGeoJSON(mapInstance, managedLayers, drawnItems);

      if (!geojson.features || geojson.features.length === 0) {
        showNotification('Info', 'No features to export', 'info');
        return;
      }

      // Call server API
      const blob = await exportMapPDFServer(geojson, pdfFormat, pdfOrientation, pdfHeading);

      // Download the PDF
      downloadBlob(blob, `map_export_${pdfFormat}_${pdfOrientation}.pdf`);

      showNotification('Success', 'PDF exported successfully from server!', 'success');
    } catch (error: any) {
      console.error('Server PDF export error:', error);
      showNotification('Error', error.message || 'Server PDF export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPNG = async () => {
    if (!mapInstance) {
      showNotification('Error', 'Map not initialized', 'error');
      return;
    }

    try {
      setExporting(true);
      onClose();
      showNotification('Info', 'Preparing PNG export...', 'info');

      // Collect GeoJSON
      const geojson = collectMapGeoJSON(mapInstance, managedLayers, drawnItems);

      if (!geojson.features || geojson.features.length === 0) {
        showNotification('Info', 'No features to export', 'info');
        return;
      }

      // Call server API
      const blob = await exportMapPNG(geojson, pngWidth, pngHeight, pngDPI);

      // Download the PNG
      downloadBlob(blob, 'map_export.png');

      showNotification('Success', 'PNG exported successfully!', 'success');
    } catch (error: any) {
      console.error('PNG export error:', error);
      showNotification('Error', error.message || 'PNG export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportShapefile = async () => {
    if (!mapInstance) {
      showNotification('Error', 'Map not initialized', 'error');
      return;
    }

    try {
      setExporting(true);
      onClose();
      showNotification('Info', 'Converting to shapefile...', 'info');

      // Collect GeoJSON
      const geojson = collectMapGeoJSON(mapInstance, managedLayers, drawnItems);

      if (!geojson.features || geojson.features.length === 0) {
        showNotification('Info', 'No features to export', 'info');
        return;
      }

      // Call server API
      const blob = await geojsonToShapefile(geojson, shapefileName);

      // Download the ZIP
      downloadBlob(blob, `${shapefileName}.zip`);

      showNotification('Success', 'Shapefile exported successfully!', 'success');
    } catch (error: any) {
      console.error('Shapefile export error:', error);
      showNotification('Error', error.message || 'Shapefile export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportGeoJSON = () => {
    try {
      if (!mapInstance) {
        showNotification('Error', 'Map not initialized', 'error');
        return;
      }
      const fc = collectMapGeoJSON(mapInstance, managedLayers, drawnItems);
      if (!fc.features.length) {
        showNotification('Info', 'No features to export', 'info');
        return;
      }
      const pretty = JSON.stringify(fc, null, 2);
      downloadTextFile('map_features.geojson', pretty, 'application/geo+json');
      onClose();
      showNotification('Success', 'GeoJSON exported', 'success');
    } catch (e) {
      showNotification('Error', 'Failed to export GeoJSON', 'error');
    }
  };

  if (!isOpen) return null;

  const portalTarget = typeof document !== 'undefined' ? (document.fullscreenElement as Element ?? document.body) : null;
  if (!portalTarget) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 8,
    padding: '7px 11px', fontSize: 12, color: '#1e293b', outline: 'none',
    background: '#f8fafc', transition: 'border-color 0.15s',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 0.6,
    fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4, display: 'block',
  };

  const FORMATS = [
    { id: 'a4', label: 'A4' },
    { id: 'a3', label: 'A3' },
  ];
  const ORIENTATIONS = [
    { id: 'landscape', label: 'Landscape', icon: 'fg-extent' },
    { id: 'portrait', label: 'Portrait', icon: 'fg-extent' },
  ];

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99997, pointerEvents: 'all', background: 'rgba(2,6,23,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: 'calc(100vw - 2rem)', maxHeight: '90vh',
        background: '#fff', borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column',
      }}>

        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #7c3aed 100%)',
          padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '7px 9px', display: 'flex', alignItems: 'center' }}>
              <i className="fg-layer-download" style={{ fontSize: 18, color: '#fff' }} />
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: 0.3 }}>Export Map</div>
              <div style={{ color: '#bfdbfe', fontSize: 10, fontFamily: 'monospace', letterSpacing: 0.5 }}>PDF · GeoJSON · Shapefile</div>
            </div>
          </div>
          <button onClick={onClose} disabled={exporting} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.28)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.15)'; }}
          >✕</button>
        </div>

        {/* ── Tab bar ── */}
        <div style={{ display: 'flex', borderBottom: '1.5px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
          {[
            { key: 'client', label: 'Browser Export', icon: 'fg-globe', color: '#2563eb' },
            { key: 'server', label: 'Server Export', icon: 'fg-cloud-download', color: '#7c3aed' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setExportType(tab.key as any)}
              style={{
                flex: 1, padding: '11px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                color: exportType === tab.key ? tab.color : '#64748b',
                borderBottom: exportType === tab.key ? `2.5px solid ${tab.color}` : '2.5px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <i className={tab.icon} style={{ fontSize: 13 }} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 22px' }}>

          {/* ── CLIENT TAB ── */}
          {exportType === 'client' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Info banner */}
              <div style={{ background: 'linear-gradient(90deg,#eff6ff,#f0fdf4)', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fg-globe" style={{ color: '#2563eb', fontSize: 14 }} />
                <span style={{ fontSize: 11, color: '#1e40af', fontWeight: 500 }}>Generated in your browser — no server required</span>
              </div>

              {/* PDF Settings */}
              <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(90deg,#eff6ff,#f8faff)', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fg-file" style={{ color: '#2563eb', fontSize: 13 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', letterSpacing: 0.5, fontFamily: 'monospace' }}>PDF SETTINGS</span>
                </div>
                <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Map Title</label>
                    <input type="text" value={pdfHeading} onChange={e => setPdfHeading(e.target.value)}
                      style={inputStyle} placeholder="Map Export"
                      onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#2563eb'; }}
                      onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#e2e8f0'; }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>DPI Quality</label>
                    <input type="number" min={72} max={600} value={pdfDPI} onChange={e => setPdfDPI(parseInt(e.target.value || '200', 10))}
                      style={inputStyle}
                      onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#2563eb'; }}
                      onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#e2e8f0'; }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Paper Size</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {FORMATS.map(f => (
                        <button key={f.id} onClick={() => setPdfFormat(f.id as any)}
                          style={{
                            flex: 1, padding: '7px 0', borderRadius: 8, border: `1.5px solid ${pdfFormat === f.id ? '#2563eb' : '#e2e8f0'}`,
                            background: pdfFormat === f.id ? '#eff6ff' : '#fff', color: pdfFormat === f.id ? '#2563eb' : '#64748b',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >{f.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Orientation</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {ORIENTATIONS.map(o => (
                        <button key={o.id} onClick={() => setPdfOrientation(o.id as any)}
                          style={{
                            flex: 1, padding: '7px 4px', borderRadius: 8, border: `1.5px solid ${pdfOrientation === o.id ? '#2563eb' : '#e2e8f0'}`,
                            background: pdfOrientation === o.id ? '#eff6ff' : '#fff', color: pdfOrientation === o.id ? '#2563eb' : '#64748b',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >{o.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Export buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={handleExportPDF} disabled={exporting}
                  style={{
                    padding: '11px 0', borderRadius: 10, border: 'none', cursor: exporting ? 'not-allowed' : 'pointer',
                    background: exporting ? '#cbd5e1' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                    color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    boxShadow: exporting ? 'none' : '0 4px 14px rgba(37,99,235,0.35)', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { if (!exporting) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                >
                  <i className="fg-file" style={{ fontSize: 14 }} />
                  {exporting ? 'Exporting…' : 'Export PDF'}
                </button>
                <button onClick={handleExportGeoJSON} disabled={exporting}
                  style={{
                    padding: '11px 0', borderRadius: 10, border: 'none', cursor: exporting ? 'not-allowed' : 'pointer',
                    background: exporting ? '#cbd5e1' : 'linear-gradient(135deg,#059669,#047857)',
                    color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    boxShadow: exporting ? 'none' : '0 4px 14px rgba(5,150,105,0.35)', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { if (!exporting) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                >
                  <i className="fg-layer-geojson" style={{ fontSize: 14 }} />
                  {exporting ? 'Exporting…' : 'Export GeoJSON'}
                </button>
              </div>
            </div>
          )}

          {/* ── SERVER TAB ── */}
          {exportType === 'server' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Info banner */}
              <div style={{ background: 'linear-gradient(90deg,#faf5ff,#f5f3ff)', border: '1px solid #e9d5ff', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fg-cloud-download" style={{ color: '#7c3aed', fontSize: 14 }} />
                <span style={{ fontSize: 11, color: '#6b21a8', fontWeight: 500 }}>High-quality server-side export with north arrow, scale bar & coordinates</span>
              </div>

              {/* Shapefile Export */}
              <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(90deg,#f0fdf4,#f8fff9)', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fg-layer-shapefile" style={{ color: '#059669', fontSize: 13 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#065f46', letterSpacing: 0.5, fontFamily: 'monospace' }}>SHAPEFILE EXPORT</span>
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: '#059669', background: '#d1fae5', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>.ZIP</span>
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <label style={labelStyle}>Filename (no extension)</label>
                  <input type="text" value={shapefileName} onChange={e => setShapefileName(e.target.value)}
                    style={{ ...inputStyle, marginBottom: 12 }} placeholder="map_export"
                    onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#059669'; }}
                    onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#e2e8f0'; }}
                  />
                  <button onClick={handleExportShapefile} disabled={exporting}
                    style={{
                      width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
                      cursor: exporting ? 'not-allowed' : 'pointer',
                      background: exporting ? '#cbd5e1' : 'linear-gradient(135deg,#059669,#047857)',
                      color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      boxShadow: exporting ? 'none' : '0 4px 14px rgba(5,150,105,0.35)', transition: 'all 0.18s',
                    }}
                    onMouseEnter={e => { if (!exporting) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                  >
                    <i className="fg-layer-shapefile" style={{ fontSize: 14 }} />
                    {exporting ? 'Exporting…' : 'Export Shapefile (.zip)'}
                  </button>
                </div>
              </div>

              {/* PDF Server Export */}
              <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(90deg,#faf5ff,#f5f3ff)', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fg-file" style={{ color: '#7c3aed', fontSize: 13 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b21a8', letterSpacing: 0.5, fontFamily: 'monospace' }}>PDF (SERVER)</span>
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: '#7c3aed', background: '#ede9fe', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>HIGH RES</span>
                </div>
                <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Map Title</label>
                    <input type="text" value={pdfHeading} onChange={e => setPdfHeading(e.target.value)}
                      style={inputStyle} placeholder="Map Export"
                      onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#7c3aed'; }}
                      onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#e2e8f0'; }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Paper Size</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {FORMATS.map(f => (
                        <button key={f.id} onClick={() => setPdfFormat(f.id as any)}
                          style={{
                            flex: 1, padding: '7px 0', borderRadius: 8, border: `1.5px solid ${pdfFormat === f.id ? '#7c3aed' : '#e2e8f0'}`,
                            background: pdfFormat === f.id ? '#faf5ff' : '#fff', color: pdfFormat === f.id ? '#7c3aed' : '#64748b',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >{f.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Orientation</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {ORIENTATIONS.map(o => (
                        <button key={o.id} onClick={() => setPdfOrientation(o.id as any)}
                          style={{
                            flex: 1, padding: '7px 4px', borderRadius: 8, border: `1.5px solid ${pdfOrientation === o.id ? '#7c3aed' : '#e2e8f0'}`,
                            background: pdfOrientation === o.id ? '#faf5ff' : '#fff', color: pdfOrientation === o.id ? '#7c3aed' : '#64748b',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >{o.label}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <button onClick={handleExportPDFServer} disabled={exporting}
                      style={{
                        width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
                        cursor: exporting ? 'not-allowed' : 'pointer',
                        background: exporting ? '#cbd5e1' : 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                        color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        boxShadow: exporting ? 'none' : '0 4px 14px rgba(124,58,237,0.35)', transition: 'all 0.18s',
                      }}
                      onMouseEnter={e => { if (!exporting) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                    >
                      <i className="fg-file" style={{ fontSize: 14 }} />
                      {exporting ? 'Exporting…' : 'Export PDF (Server)'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '12px 22px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
            {managedLayers.filter(l => l.visible).length} visible layer{managedLayers.filter(l => l.visible).length !== 1 ? 's' : ''} will be exported
          </span>
          <button onClick={onClose} disabled={exporting}
            style={{ padding: '6px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
          >Cancel</button>
        </div>
      </div>
    </div>,
    portalTarget
  );
}