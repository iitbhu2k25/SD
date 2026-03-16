// app/vector/components/ExportModal.tsx
import React, { useState } from 'react';
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

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-50">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      
      <div className="relative z-10 bg-white rounded-xl shadow-xl p-5 w-[min(600px,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Export Map</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800"
            aria-label="Close"
            disabled={exporting}
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Export Format Tabs */}
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setExportType('client')}
              className={`px-4 py-2 font-medium transition-colors ${
                exportType === 'client'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Client Export
            </button>
            <button
              onClick={() => setExportType('server')}
              className={`px-4 py-2 font-medium transition-colors ${
                exportType === 'server'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Server Export
            </button>
          </div>

          {/* Client Export Options */}
          {exportType === 'client' && (
            <>
              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                <strong>Client Export:</strong> PDF and GeoJSON generated in browser
              </div>

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
                  disabled={exporting}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {exporting ? 'Exporting...' : 'Export PDF (Client)'}
                </button>
                
                <button
                  onClick={handleExportGeoJSON}
                  disabled={exporting}
                  className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {exporting ? 'Exporting...' : 'Export GeoJSON'}
                </button>
              </div>
            </>
          )}

          {/* Server Export Options */}
          {exportType === 'server' && (
            <>
              <div className="bg-purple-50 p-3 rounded-lg text-sm text-purple-800">
                <strong>Server Export:</strong> High-quality exports with north arrow, scale, and coordinates
              </div>

              {/* PNG Export Section */}
              {/* <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">PNG Export</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-sm mb-1">Width (px)</label>
                    <input
                      type="number"
                      min={800}
                      max={4000}
                      value={pngWidth}
                      onChange={(e) => setPngWidth(parseInt(e.target.value || '1920', 10))}
                      className="w-full border rounded-md px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Height (px)</label>
                    <input
                      type="number"
                      min={600}
                      max={4000}
                      value={pngHeight}
                      onChange={(e) => setPngHeight(parseInt(e.target.value || '1080', 10))}
                      className="w-full border rounded-md px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">DPI</label>
                    <input
                      type="number"
                      min={72}
                      max={600}
                      value={pngDPI}
                      onChange={(e) => setPngDPI(parseInt(e.target.value || '300', 10))}
                      className="w-full border rounded-md px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={handleExportPNG}
                  disabled={exporting}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {exporting ? 'Exporting...' : 'Export PNG'}
                </button>
              </div> */}

              {/* PDF Export Section */}
              {/* <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">PDF Export (Server)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="sm:col-span-2">
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
                <button
                  onClick={handleExportPDFServer}
                  disabled={exporting}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {exporting ? 'Exporting...' : 'Export PDF (Server)'}
                </button>
              </div> */}

              {/* Shapefile Export Section */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">Shapefile Export</h4>
                <div className="mb-3">
                  <label className="block text-sm mb-1">Filename (without extension)</label>
                  <input
                    type="text"
                    value={shapefileName}
                    onChange={(e) => setShapefileName(e.target.value)}
                    className="w-full border rounded-md px-2 py-1 text-sm"
                    placeholder="Heding Map"
                  />
                </div>
                <button
                  onClick={handleExportShapefile}
                  disabled={exporting}
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {exporting ? 'Exporting...' : 'Export Shapefile (.zip)'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}