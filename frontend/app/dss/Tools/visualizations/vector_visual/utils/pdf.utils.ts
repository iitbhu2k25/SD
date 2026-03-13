// PDF export functionality

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { PDFExportOptions, ArcMapCoordinate } from '../types/map.types';
import { parseTranslateFromTransform, formatLatitude, formatLongitude } from './helpers';

/**
 * Calculate ArcMap-style coordinate labels for PDF borders
 */
export function calculateArcMapCoordinates(
  bounds: any, 
  frameW: number, 
  frameH: number
): ArcMapCoordinate[] {
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

  const coordinates: ArcMapCoordinate[] = [];

  // Top labels
  for (let i = 0; i <= topLabelsCount; i++) {
    const ratio = i / topLabelsCount;
    const lng = nw.lng + (ne.lng - nw.lng) * ratio;
    const lat = nw.lat;
    coordinates.push({ x: ratio * frameW, y: -15, lat, lng, position: 'top' });
  }

  // Right labels
  for (let i = 0; i <= rightLabelsCount; i++) {
    const ratio = i / rightLabelsCount;
    const lat = ne.lat + (se.lat - ne.lat) * ratio;
    const lng = ne.lng;
    coordinates.push({ x: frameW + 50, y: ratio * frameH + 8, lat, lng, position: 'right' });
  }

  // Bottom labels
  for (let i = 0; i <= bottomLabelsCount; i++) {
    const ratio = i / bottomLabelsCount;
    const lng = sw.lng + (se.lng - sw.lng) * ratio;
    const lat = sw.lat;
    coordinates.push({ x: ratio * frameW, y: frameH + 15, lat, lng, position: 'bottom' });
  }

  // Left labels
  for (let i = 0; i <= leftLabelsCount; i++) {
    const ratio = i / leftLabelsCount;
    const lat = nw.lat + (sw.lat - nw.lat) * ratio;
    const lng = nw.lng;
    coordinates.push({ x: -8, y: ratio * frameH - 5, lat, lng, position: 'left' });
  }

  return coordinates;
}

/**
 * Export map to PDF with customizable options
 */
export async function exportMapToPDF(opts: PDFExportOptions): Promise<void> {
  const { mapEl, mapInstance, heading, qualityDPI, pageFormat, orientation, currentBasemapId } = opts;

  const bounds = mapInstance.getBounds();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const scale = Math.max(1, qualityDPI / 96) * dpr;

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

  // Get all map panes
  const mapPane = mapEl.querySelector('.leaflet-map-pane') as HTMLElement | null;
  const tilePane = mapEl.querySelector('.leaflet-tile-pane') as HTMLElement | null;
  const objectsPane = mapEl.querySelector('.leaflet-objects-pane') as HTMLElement | null;
  const markerPane = mapEl.querySelector('.leaflet-marker-pane') as HTMLElement | null;
  const overlayPane = mapEl.querySelector('.leaflet-overlay-pane') as HTMLElement | null;
  const shadowPane = mapEl.querySelector('.leaflet-shadow-pane') as HTMLElement | null;

  const panes: HTMLElement[] = [mapPane, tilePane, objectsPane, markerPane, overlayPane, shadowPane]
    .filter(Boolean) as HTMLElement[];
  
  const saved: Array<{ el: HTMLElement; transform: string; left: string; top: string }> = [];

  // Normalize transforms
  const normalizeTransform = (el: HTMLElement) => {
    const computed = getComputedStyle(el);
    const transform = computed.transform || 'none';
    const { tx, ty } = parseTranslateFromTransform(transform);
    
    saved.push({ 
      el, 
      transform: el.style.transform, 
      left: el.style.left, 
      top: el.style.top 
    });
    
    el.style.transform = 'none';
    const curLeft = parseFloat((el.style.left || '0').replace('px', '')) || 0;
    const curTop = parseFloat((el.style.top || '0').replace('px', '')) || 0;
    el.style.left = `${curLeft + tx}px`;
    el.style.top = `${curTop + ty}px`;
  };

  panes.forEach(normalizeTransform);

  mapInstance.invalidateSize();
  await new Promise(res => setTimeout(res, 300));

  // Capture map as canvas
  const canvas = await html2canvas(mapEl, {
    scale,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    ignoreElements: (element) => element.classList?.contains('pointer-events-auto') || false,
    foreignObjectRendering: false
  });

  // Restore transforms
  saved.forEach(({ el, transform, left, top }) => {
    el.style.transform = transform;
    el.style.left = left;
    el.style.top = top;
  });

  // Restore map interactions
  if (origDragging) mapInstance.dragging.enable();
  if (origScrollZoom) mapInstance.scrollWheelZoom.enable();
  if (origBoxZoom) mapInstance.boxZoom.enable();
  if (origDoubleClickZoom) mapInstance.doubleClickZoom.enable();

  // Show UI overlays
  uiOverlays.forEach(el => (el.style.visibility = ''));

  // Create PDF
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

  // Add header
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(heading || 'Map Export', pageW / 2, margin + 25, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  doc.text(`${currentDate}`, pageW / 2, margin + 40, { align: 'center' });

  // Add map image
  const imgData = canvas.toDataURL('image/png', 0.95);
  doc.addImage(imgData, 'PNG', imgX, imgY, drawW, drawH);

  // Add border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.rect(frameLeft, frameTop, frameW, frameH);

  // Add coordinate labels
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
    
    // Add tick marks
    if (coord.position === 'top') doc.line(x, frameTop, x, frameTop - 5);
    else if (coord.position === 'bottom') doc.line(x, frameTop + frameH, x, frameTop + frameH + 5);
    else if (coord.position === 'left') doc.line(frameLeft, y, frameLeft - 5, y);
    else if (coord.position === 'right') doc.line(frameLeft + frameW, y, frameLeft + frameW + 5, y);
  });

  // Add compass, scale bar, and metadata
  addMapElements(doc, frameLeft, frameTop, frameW, frameH, bounds, currentBasemapId);

  doc.save(`map_export_${pageFormat}_${orientation}.pdf`);
}

/**
 * Add compass, scale bar, and metadata to PDF
 */
function addMapElements(
  doc: jsPDF,
  frameLeft: number,
  frameTop: number,
  frameW: number,
  frameH: number,
  bounds: any,
  currentBasemapId?: string
): void {
  const belowMapY = frameTop + frameH + 20;
  
  // Compass
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

  // Metadata
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
}