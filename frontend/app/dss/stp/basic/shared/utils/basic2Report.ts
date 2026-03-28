'use client';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_BASE_URL } from './constants';
import type { ConfirmedLocation } from '../types/location.types';
import type {
  PopulationReportData,
  WaterDemandReportData,
  WaterSupplyReportData,
  SewageReportData,
} from '../store/basic.store';

export interface Basic2ReportInput {
  confirmedLocation: ConfirmedLocation | null;
  selectedPopMethod: string | null;
  populationForecast: Record<number, number> | null;
  population2025: number | null;
  waterDemandTotals: Record<number, number> | null;
  waterSupplyTotal: number | null;
  populationReportData: PopulationReportData | null;
  waterDemandReportData: WaterDemandReportData | null;
  waterSupplyReportData: WaterSupplyReportData | null;
  sewageReportData: SewageReportData | null;
}

type Row = Array<string | number>;

// ── Layout ────────────────────────────────────────────────────────────────
const PAGE = { left: 16, right: 16, top: 18, bottom: 22 };

// ── Colour palette ────────────────────────────────────────────────────────
const C_NAVY:   [number, number, number] = [10,  36,  99];   // header / cover band
const C_BLUE:   [number, number, number] = [28,  78, 190];   // primary accent
const C_GREEN:  [number, number, number] = [4,  108,  78];   // population / growth
const C_TEAL:   [number, number, number] = [5,  120, 155];   // water demand
const C_VIOLET: [number, number, number] = [99,  38, 210];   // water supply
const C_ORANGE: [number, number, number] = [173,  72,   9];  // sewage
const C_TEXT:   [number, number, number] = [8,   14,  32];   // near-black body
const C_MUTED:  [number, number, number] = [60,  75, 110];   // secondary text
const C_RULE:   [number, number, number] = [200, 210, 230];  // grid/rule lines
const C_ALTROW: [number, number, number] = [246, 248, 254];  // table alt row

const CHART_COLORS: Array<[number, number, number]> = [
  [28, 78, 190], [4, 120, 90], [200, 30, 100], [109, 40, 217], [180, 90, 9], [6, 130, 165],
];

interface TocEntry { title: string; page: number; }

// ── Tiny helpers ─────────────────────────────────────────────────────────
function fmtShort(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
  return String(Math.round(v));
}

function rgb(c: [number, number, number]) { return `rgb(${c[0]},${c[1]},${c[2]})`; }

function getVillageCodes(location: ConfirmedLocation | null): string[] {
  if (!location) return [];
  if (location.mode === 'admin')
    return (location.admin?.villages ?? []).map((v: any) => String(v.village_code ?? v.id ?? '')).filter(Boolean);
  if (location.mode === 'drain')
    return (location.drain?.villages ?? []).map((v: any) => String(v.village_code ?? v.vlcode ?? v.shapeID ?? '')).filter(Boolean);
  if (location.mode === 'india_catchment')
    return (location.indiaCatchment?.villages ?? []).map((v: any) => String(v.vlcode ?? v.village_code ?? '')).filter(Boolean);
  return [];
}

async function fetchStudyAreaMap(villageCodes: string[]): Promise<string | null> {
  if (!villageCodes.length) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/basic/studyareamap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ village_codes: villageCodes }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.map_base64;
    if (!raw || typeof raw !== 'string') return null;
    return raw.startsWith('data:image') ? raw : `data:image/png;base64,${raw}`;
  } catch { return null; }
}

function imageToDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function estimateTotalSewageVolume(input: Basic2ReportInput): number {
  const sg = input.sewageReportData;
  if (!sg) return 0;
  if (sg.peakRows?.length) {
    const last = [...sg.peakRows].sort((a: any, b: any) => Number(a.year) - Number(b.year)).pop();
    const avg = Number(last?.avg_sewage_flow ?? last?.avg ?? 0);
    if (avg > 0) return avg;
  }
  if (sg.waterSupplyResult != null) return Number(sg.waterSupplyResult);
  return 0;
}

function locationRows(location: ConfirmedLocation | null): Row[] {
  if (!location) return [['Mode', 'N/A']];
  if (location.mode === 'admin' && location.admin)
    return [
      ['Mode', 'Administrative'],
      ['State', location.admin.state?.state_name ?? '-'],
      ['Districts', location.admin.districts.length],
      ['Sub-Districts', location.admin.subDistricts.length],
      ['Villages', location.admin.villages.length],
      ['Label', location.label],
    ];
  if (location.mode === 'drain' && location.drain)
    return [
      ['Mode', 'Drain'],
      ['River', location.drain.river?.name ?? '-'],
      ['Stretch', location.drain.stretch?.name ?? '-'],
      ['Drains', location.drain.drains.length],
      ['Villages', location.drain.villages.length],
      ['Total Population', location.drain.totalPopulation.toLocaleString()],
      ['Label', location.label],
    ];
  if (location.mode === 'india_catchment' && location.indiaCatchment)
    return [
      ['Mode', 'India Catchment'],
      ['Latitude', location.indiaCatchment.point.lat.toFixed(4)],
      ['Longitude', location.indiaCatchment.point.lng.toFixed(4)],
      ['Villages', location.indiaCatchment.villages.length],
      ['Total Population', location.indiaCatchment.totalPopulation.toLocaleString()],
      ['Label', location.label],
    ];
  return [['Mode', location.mode], ['Label', location.label]];
}

// ── Page layout helpers ───────────────────────────────────────────────────
function currentPage(doc: jsPDF): number {
  return (doc as any).internal.getCurrentPageInfo().pageNumber;
}

function nextPageIfNeeded(doc: jsPDF, y: number, reserve = 28): number {
  if (y + reserve > doc.internal.pageSize.getHeight() - PAGE.bottom) {
    doc.addPage();
    return PAGE.top;
  }
  return y;
}

function drawRunningFooter(doc: jsPDF, pageWidth: number, pageHeight: number, pageNum: number, total: number) {
  const fy = pageHeight - PAGE.bottom + 5;
  doc.setDrawColor(...C_RULE);
  doc.setLineWidth(0.4);
  doc.line(PAGE.left, fy - 2, pageWidth - PAGE.right, fy - 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C_MUTED);
  doc.text('DSS Platform — IIT BHU / SLCR', PAGE.left, fy + 4);
  doc.text(`Page ${pageNum} of ${total}`, pageWidth - PAGE.right, fy + 4, { align: 'right' });
}

// ── Cover page ────────────────────────────────────────────────────────────
function drawCoverPage(
  doc: jsPDF,
  leftLogo: string | null,
  rightLogo: string | null,
  input: Basic2ReportInput,
  now: Date,
  pageWidth: number,
  pageHeight: number,
) {
  // Top banner band
  doc.setFillColor(...C_NAVY);
  doc.rect(0, 0, pageWidth, 68, 'F');

  // Decorative accent stripe inside banner
  doc.setFillColor(...C_BLUE);
  doc.rect(0, 64, pageWidth, 4, 'F');

  // Logos in banner
  if (leftLogo)  doc.addImage(leftLogo,  'PNG', 14, 6, 26, 26);
  if (rightLogo) doc.addImage(rightLogo, 'PNG', pageWidth - 40, 6, 26, 26);

  // Institute title inside banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(200, 220, 255);
  doc.text('Indian Institute of Technology (BHU), Varanasi', pageWidth / 2, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(160, 185, 230);
  doc.text('Sewer & Catchment Research | Decision Support System', pageWidth / 2, 28, { align: 'center' });

  // Report title in banner (large white)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('COMPREHENSIVE REPORT', pageWidth / 2, 46, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 210, 255);
  doc.text('Sewage Generation & Water Resource Management', pageWidth / 2, 56, { align: 'center' });

  // White body area — main title block
  const bodyY = 82;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...C_NAVY);
  doc.text('DSS Basic2', pageWidth / 2, bodyY, { align: 'center' });
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...C_MUTED);
  const subLines = doc.splitTextToSize(
    'This report presents population forecasting, water demand, water supply and sewage generation analysis for the selected study area, following CPHEEO standards and Census-based projections.',
    pageWidth - 40,
  );
  doc.text(subLines, pageWidth / 2, bodyY + 10, { align: 'center' });

  // Separator
  doc.setDrawColor(...C_BLUE);
  doc.setLineWidth(1.2);
  doc.line(PAGE.left + 10, bodyY + 30, pageWidth - PAGE.left - 10, bodyY + 30);

  // Location info box
  const boxY = bodyY + 38;
  doc.setFillColor(242, 246, 255);
  doc.setDrawColor(...C_BLUE);
  doc.setLineWidth(0.6);
  doc.roundedRect(PAGE.left, boxY, pageWidth - PAGE.left - PAGE.right, 52, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C_BLUE);
  doc.text('STUDY AREA', PAGE.left + 6, boxY + 8);

  const loc = input.confirmedLocation;
  const infoRows: [string, string][] = [
    ['Location', loc?.label ?? 'Not specified'],
    ['Mode', loc ? (loc.mode === 'admin' ? 'Administrative' : loc.mode === 'drain' ? 'Drain' : 'India Catchment') : '-'],
    ['Population (2025)', input.population2025 != null ? input.population2025.toLocaleString() : '-'],
    ['Population Method', input.selectedPopMethod ?? '-'],
    ['Total Supply (MLD)', input.waterSupplyTotal != null ? input.waterSupplyTotal.toFixed(3) : '-'],
  ];

  let infoY = boxY + 15;
  infoRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C_TEXT);
    doc.text(`${label}:`, PAGE.left + 6, infoY);
    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...C_MUTED);
    const val = doc.splitTextToSize(value, pageWidth - PAGE.left - PAGE.right - 55);
    doc.text(val, PAGE.left + 52, infoY);
    infoY += 7.5;
  });

  // Bottom navy band
  doc.setFillColor(...C_NAVY);
  doc.rect(0, pageHeight - 32, pageWidth, 32, 'F');
  doc.setFillColor(...C_BLUE);
  doc.rect(0, pageHeight - 34, pageWidth, 2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 200, 240);
  doc.text(
    `Generated: ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} at ${now.toLocaleTimeString('en-IN')}`,
    pageWidth / 2, pageHeight - 22, { align: 'center' },
  );
  doc.setFontSize(7.5);
  doc.setTextColor(130, 160, 210);
  doc.text('Confidential — For planning and decision-support use only', pageWidth / 2, pageHeight - 14, { align: 'center' });
}

// ── TOC page ──────────────────────────────────────────────────────────────
function drawTocPage(doc: jsPDF, entries: TocEntry[], pageWidth: number) {
  // TOC title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...C_NAVY);
  doc.text('TABLE OF CONTENTS', pageWidth / 2, PAGE.top + 4, { align: 'center' });

  doc.setDrawColor(...C_BLUE);
  doc.setLineWidth(1);
  doc.line(PAGE.left, PAGE.top + 9, pageWidth - PAGE.right, PAGE.top + 9);

  let y = PAGE.top + 18;
  const contentW = pageWidth - PAGE.left - PAGE.right;

  entries.forEach((entry, idx) => {
    const isMain = /^\d+\.\s/.test(entry.title);
    const indent = isMain ? 0 : 6;
    const fSize  = isMain ? 11 : 10;
    const fStyle = isMain ? 'bold' : 'normal';

    doc.setFont('helvetica', fStyle);
    doc.setFontSize(fSize);
    doc.setTextColor(...C_TEXT);

    // Number dot on left
    if (isMain) {
      doc.setFillColor(...C_BLUE);
      doc.circle(PAGE.left + 2, y - 1.5, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fSize);
      doc.setTextColor(255, 255, 255);
      // no number text in circle - just decorative
    }

    // Title text
    doc.setFont('helvetica', fStyle);
    doc.setTextColor(...C_TEXT);
    const label = doc.splitTextToSize(entry.title, contentW - 30)[0];
    doc.text(label, PAGE.left + 6 + indent, y);

    // Page number
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C_NAVY);
    const pnStr = String(entry.page);
    doc.text(pnStr, pageWidth - PAGE.right, y, { align: 'right' });

    // Dotted leader
    doc.setDrawColor(...C_RULE);
    doc.setLineWidth(0.3);
    const titleEnd = PAGE.left + 6 + indent + doc.getTextWidth(label) + 3;
    const pnStart  = pageWidth - PAGE.right - doc.getTextWidth(pnStr) - 4;
    if (pnStart > titleEnd + 6) {
      const dotStep = 3;
      for (let dx = titleEnd; dx < pnStart - 2; dx += dotStep) {
        doc.circle(dx, y - 0.5, 0.25, 'F');
      }
    }

    // Clickable link over the full row
    doc.link(PAGE.left, y - 5, contentW, 6, { pageNumber: entry.page });

    y += isMain ? 9 : 7.5;

    // Divider after main sections
    if (isMain && idx < entries.length - 1) {
      doc.setDrawColor(...C_RULE);
      doc.setLineWidth(0.2);
      doc.line(PAGE.left, y - 3, pageWidth - PAGE.right, y - 3);
    }
  });
}

// ── Section title ─────────────────────────────────────────────────────────
function sectionTitle(
  doc: jsPDF,
  text: string,
  y: number,
  tocEntries: TocEntry[],
  color: [number, number, number] = C_BLUE,
): number {
  y = nextPageIfNeeded(doc, y, 32);
  tocEntries.push({ title: text, page: currentPage(doc) });

  // Left accent bar
  doc.setFillColor(...color);
  doc.roundedRect(PAGE.left, y, 4, 10, 1.2, 1.2, 'F');

  // Title text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C_TEXT);
  doc.text(text, PAGE.left + 8, y + 7.5);

  // Subtle underline spanning full content width
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.25);
  doc.line(PAGE.left + 8, y + 11.5, doc.internal.pageSize.getWidth() - PAGE.right, y + 11.5);

  return y + 17;
}

function subTitle(doc: jsPDF, text: string, y: number, color: [number, number, number] = C_BLUE): number {
  y = nextPageIfNeeded(doc, y, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...color);
  doc.text(text, PAGE.left, y);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.35);
  doc.line(PAGE.left, y + 2.5, PAGE.left + doc.getTextWidth(text), y + 2.5);
  return y + 11;
}

// ── Body paragraph ────────────────────────────────────────────────────────
function paragraph(doc: jsPDF, text: string, y: number): number {
  y = nextPageIfNeeded(doc, y, 20);
  autoTable(doc, {
    startY: y,
    body: [[text]],
    theme: 'plain',
    styles: {
      font: 'times',
      fontSize: 11.5,
      textColor: C_TEXT,
      halign: 'justify',
      lineColor: [255, 255, 255],
      cellPadding: { top: 0.5, bottom: 0.5, left: 0, right: 0 },
      overflow: 'linebreak',
    },
    margin: { left: PAGE.left, right: PAGE.right, top: PAGE.top, bottom: PAGE.bottom },
  });
  return ((doc as any).lastAutoTable?.finalY ?? y) + 5;
}

// ── Data table ────────────────────────────────────────────────────────────
function dataTable(
  doc: jsPDF,
  y: number,
  head: Row,
  body: Row[],
  color: [number, number, number],
  opts?: { emphasizeFirstCol?: boolean; compact?: boolean },
): number {
  const fs  = opts?.compact ? 9.5 : 10;
  const pad = opts?.compact ? 2.5 : 3.2;
  autoTable(doc, {
    startY: y,
    head: [head],
    body: body.length ? body : [['-', 'No data']],
    theme: 'grid',
    styles: {
      font: 'times',
      fontSize: fs,
      cellPadding: pad,
      lineColor: C_RULE,
      lineWidth: 0.18,
      textColor: C_TEXT,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: color,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: fs + 0.5,
      halign: 'center',
      cellPadding: pad + 1,
    },
    alternateRowStyles: { fillColor: C_ALTROW },
    showHead: 'everyPage',
    didParseCell: (hookData) => {
      if (opts?.emphasizeFirstCol && hookData.section === 'body' && hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [8, 20, 65];
      }
      if (hookData.section === 'body' && hookData.column.index > 0) {
        const txt = Array.isArray(hookData.cell.text) ? hookData.cell.text.join('') : String(hookData.cell.text ?? '');
        if (/^[-+]?\d[\d,]*(\.\d+)?$/.test(txt.trim())) {
          hookData.cell.styles.halign = 'right';
        }
      }
    },
    margin: { left: PAGE.left, right: PAGE.right, top: PAGE.top, bottom: PAGE.bottom },
  });
  return ((doc as any).lastAutoTable?.finalY ?? y) + 8;
}

// ── Chart: Figure box ─────────────────────────────────────────────────────
function addChartFigure(doc: jsPDF, y: number, caption: string, imageData: string | null, color: [number, number, number]): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  if (!imageData) return paragraph(doc, `${caption} could not be generated (insufficient data).`, y);
  y = nextPageIfNeeded(doc, y, 96);

  // Box background
  doc.setFillColor(248, 250, 255);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.5);
  doc.roundedRect(PAGE.left, y, pageWidth - PAGE.left - PAGE.right, 88, 2.5, 2.5, 'FD');

  // Chart image
  doc.addImage(imageData, 'PNG', PAGE.left + 3, y + 3, pageWidth - PAGE.left - PAGE.right - 6, 74);

  // Caption
  doc.setFont('times', 'italic');
  doc.setFontSize(9.5);
  doc.setTextColor(...C_MUTED);
  doc.text(caption, pageWidth / 2, y + 84, { align: 'center' });

  return y + 94;
}

// ── Population line chart ─────────────────────────────────────────────────
function buildPopulationChart(seriesMap: Record<string, Record<number, number>>): string | null {
  const seriesNames = Object.keys(seriesMap);
  if (!seriesNames.length) return null;
  const years = Array.from(new Set(seriesNames.flatMap((k) => Object.keys(seriesMap[k] ?? {}).map(Number)))).sort((a, b) => a - b);
  if (!years.length) return null;

  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 560;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const w = canvas.width, h = canvas.height;
  const left = 96, right = 32, top = 72, bottom = 88;
  const pw = w - left - right, ph = h - top - bottom;

  ctx.fillStyle = '#f8faff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0a0e20';
  ctx.font = '700 28px Arial';
  ctx.fillText('Population Forecast Chart', left, 44);

  const values = seriesNames.flatMap((k) => years.map((y) => Number(seriesMap[k]?.[y] ?? 0)));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range  = Math.max(1, maxVal - minVal);
  const yMin   = Math.max(0, minVal - range * 0.1);
  const yMax   = maxVal + range * 0.15;

  for (let i = 0; i <= 5; i++) {
    const yy = top + (ph * i) / 5;
    const value = yMax - ((yMax - yMin) * i) / 5;
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(w - right, yy); ctx.stroke();
    ctx.fillStyle = '#374151'; ctx.font = '13px Arial';
    ctx.fillText(fmtShort(value), 8, yy + 5);
  }

  ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, h - bottom); ctx.lineTo(w - right, h - bottom); ctx.stroke();

  years.forEach((year, index) => {
    const x = left + (pw * index) / Math.max(1, years.length - 1);
    ctx.fillStyle = '#1e293b'; ctx.font = '13px Arial';
    ctx.fillText(String(year), x - 16, h - bottom + 26);
  });

  seriesNames.forEach((name, idx) => {
    const color = CHART_COLORS[idx % CHART_COLORS.length];
    ctx.strokeStyle = rgb(color); ctx.fillStyle = rgb(color); ctx.lineWidth = 2.8;
    ctx.beginPath();
    years.forEach((year, index) => {
      const value = Number(seriesMap[name]?.[year] ?? 0);
      const x = left + (pw * index) / Math.max(1, years.length - 1);
      const y = top + ((yMax - value) / (yMax - yMin)) * ph;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    years.forEach((year, index) => {
      const value = Number(seriesMap[name]?.[year] ?? 0);
      const x = left + (pw * index) / Math.max(1, years.length - 1);
      const y = top + ((yMax - value) / (yMax - yMin)) * ph;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    });
  });

  let legendX = left;
  const legendY = h - 28;
  seriesNames.forEach((name, idx) => {
    const color = CHART_COLORS[idx % CHART_COLORS.length];
    const label = name.length > 24 ? `${name.slice(0, 22)}..` : name;
    ctx.fillStyle = rgb(color);
    ctx.fillRect(legendX, legendY - 10, 16, 10);
    ctx.fillStyle = '#0f172a'; ctx.font = '13px Arial';
    ctx.fillText(label, legendX + 22, legendY - 1);
    legendX += 28 + ctx.measureText(label).width;
  });

  return canvas.toDataURL('image/png');
}

// ── Cohort bar chart ──────────────────────────────────────────────────────
function buildCohortChart(cohortData: Record<string, { male: number; female: number; total: number }>): string | null {
  const ageGroups = Object.keys(cohortData).filter((k) => k !== 'total').slice(0, 14);
  if (!ageGroups.length) return null;

  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 560;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const w = canvas.width, h = canvas.height;
  const left = 96, right = 32, top = 72, bottom = 110;
  const pw = w - left - right, ph = h - top - bottom;

  ctx.fillStyle = '#f8faff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0a0e20'; ctx.font = '700 28px Arial';
  ctx.fillText('Cohort Population Distribution', left, 44);

  const maxVal = Math.max(...ageGroups.flatMap((g) => [Number(cohortData[g]?.male ?? 0), Number(cohortData[g]?.female ?? 0)]), 1);

  for (let i = 0; i <= 5; i++) {
    const yy = top + (ph * i) / 5;
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(w - right, yy); ctx.stroke();
    ctx.fillStyle = '#374151'; ctx.font = '13px Arial';
    ctx.fillText(fmtShort(maxVal - (maxVal * i) / 5), 8, yy + 5);
  }

  ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, h - bottom); ctx.lineTo(w - right, h - bottom); ctx.stroke();

  const clusterW = pw / ageGroups.length;
  const barW = Math.min(20, clusterW * 0.3);
  ageGroups.forEach((g, i) => {
    const x0 = left + clusterW * i + clusterW * 0.5;
    const male   = Number(cohortData[g]?.male ?? 0);
    const female = Number(cohortData[g]?.female ?? 0);
    const maleH   = (male   / maxVal) * ph;
    const femaleH = (female / maxVal) * ph;
    ctx.fillStyle = '#1c4fbc';
    ctx.fillRect(x0 - barW - 3, h - bottom - maleH, barW, maleH);
    ctx.fillStyle = '#db2777';
    ctx.fillRect(x0 + 3, h - bottom - femaleH, barW, femaleH);
    ctx.save();
    ctx.translate(x0 - 14, h - bottom + 24);
    ctx.rotate(-Math.PI / 5.5);
    ctx.fillStyle = '#1e293b'; ctx.font = '12px Arial';
    ctx.fillText(g.length > 10 ? `${g.slice(0, 9)}..` : g, 0, 0);
    ctx.restore();
  });

  ctx.fillStyle = '#1c4fbc'; ctx.fillRect(left, h - 26, 16, 10);
  ctx.fillStyle = '#0f172a'; ctx.font = '13px Arial'; ctx.fillText('Male', left + 22, h - 17);
  ctx.fillStyle = '#db2777'; ctx.fillRect(left + 90, h - 26, 16, 10);
  ctx.fillStyle = '#0f172a'; ctx.fillText('Female', left + 112, h - 17);

  return canvas.toDataURL('image/png');
}

// ── MAIN PDF EXPORT ───────────────────────────────────────────────────────
export async function downloadBasic2Report(input: Basic2ReportInput) {
  const doc = new jsPDF({ format: 'a4' });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();
  const tocEntries: TocEntry[] = [];

  // Pre-load assets
  const [leftLogo, rightLogo] = await Promise.all([
    imageToDataUrl('/Images/export/logo_iitbhu.png'),
    imageToDataUrl('/Images/export/right1_slcr.png'),
  ]);

  // ── PAGE 1: Cover ────────────────────────────────────────────────────────
  drawCoverPage(doc, leftLogo, rightLogo, input, now, pageWidth, pageHeight);

  // ── PAGE 2: TOC placeholder ───────────────────────────────────────────────
  doc.addPage();
  const tocPageNum = currentPage(doc);

  // ── CONTENT PAGES ────────────────────────────────────────────────────────
  doc.addPage();
  let y = PAGE.top;

  const totalSewageVolume = estimateTotalSewageVolume(input);

  // ── 1. Executive Summary ──────────────────────────────────────────────────
  y = sectionTitle(doc, '1. Executive Summary', y, tocEntries, C_BLUE);
  y = paragraph(doc, `This report presents a detailed analysis of population forecasting, water demand, water supply, and sewage generation for the selected study area. Based on available module outputs, the indicative sewage generation is approximately ${totalSewageVolume.toFixed(2)} MLD.`, y);
  y = paragraph(doc, 'The report identifies key infrastructure planning inputs and provides integrated interpretation to support treatment-capacity planning and sanitation decision making. All analyses follow CPHEEO-aligned assumptions and Census-based projections.', y);

  // ── 2. Study Area Overview ────────────────────────────────────────────────
  y = nextPageIfNeeded(doc, y, 40);
  y = sectionTitle(doc, '2. Study Area Overview', y, tocEntries, C_TEAL);
  y = paragraph(doc, 'The area under study includes selected administrative or river-catchment units and supports integrated planning for population, water demand, water supply, and sewage management. Figure 1 presents the study area map used for the analysis.', y);

  const villageCodes = getVillageCodes(input.confirmedLocation);
  const mapBase64 = await fetchStudyAreaMap(villageCodes);
  if (mapBase64) {
    y = nextPageIfNeeded(doc, y, 90);
    const mapW = 164, mapH = 98;
    const mapX = (pageWidth - mapW) / 2;
    doc.setDrawColor(...C_TEAL);
    doc.setLineWidth(0.5);
    doc.roundedRect(mapX - 2, y - 2, mapW + 4, mapH + 4, 2, 2, 'S');
    doc.addImage(mapBase64, 'PNG', mapX, y, mapW, mapH);
    y += mapH + 6;
    doc.setFont('times', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(...C_MUTED);
    doc.text('Figure 1: Study Area Map', pageWidth / 2, y, { align: 'center' });
    y += 9;
  } else {
    y = paragraph(doc, 'Study area map could not be loaded (API /basic/studyareamap unavailable).', y);
  }

  // ── 3. Methodology ─────────────────────────────────────────────────────────
  y = nextPageIfNeeded(doc, y, 50);
  y = sectionTitle(doc, '3. Methodology', y, tocEntries, C_VIOLET);
  y = paragraph(doc, 'The estimation workflow follows standard planning practice and CPHEEO-aligned assumptions: (i) population forecasting, (ii) sectoral water-demand estimation, (iii) water-supply assessment, and (iv) sewage and peak-flow analysis.', y);

  y = subTitle(doc, '3.1  Population Forecasting', y, C_VIOLET);
  y = paragraph(doc, 'Population projection considers multiple methods including arithmetic, demographic, and cohort approaches. The selected method drives downstream water-demand and sewage computations.', y);

  y = subTitle(doc, '3.2  Water Demand', y, C_VIOLET);
  y = paragraph(doc, 'Water demand is estimated using domestic, floating, institutional, and firefighting components. Seasonal behaviour is represented through multipliers where available.', y);

  y = subTitle(doc, 'Table 1 — Recommended Per Capita Water Supply Levels (CPHEEO)', y, C_TEAL);
  y = dataTable(doc, y,
    ['S.No.', 'Classification of Towns / Cities', 'Recommended Level (LPCD)'],
    [
      ['1', 'Towns with piped supply but without sewerage', '70'],
      ['2', 'Cities with piped supply and sewerage', '135'],
      ['3', 'Metropolitan / mega cities with sewerage', '150'],
    ],
    C_TEAL, { compact: true },
  );

  y = subTitle(doc, 'Table 2 — Floating Population Demand Rates', y, C_TEAL);
  y = dataTable(doc, y,
    ['S.No.', 'Facility Condition', 'Demand (LPCD)'],
    [
      ['1', 'Bathing facilities provided', '45'],
      ['2', 'Bathing facilities not provided', '25'],
      ['3', 'Only public facilities used', '15'],
    ],
    [6, 120, 155], { compact: true },
  );

  y = subTitle(doc, 'Table 3 — Institutional Demand Reference Rates', y, C_VIOLET);
  y = dataTable(doc, y,
    ['S.No.', 'Institution', 'Demand Basis'],
    [
      ['1', 'Hospitals (>100 beds / ≤100 beds)', '450 / 340 per bed'],
      ['2', 'Hotels', '180 per bed'],
      ['3', 'Hostels / Nurses homes / Boarding schools', '135 per capita'],
      ['4', 'Restaurants', '70 per seat'],
      ['5', 'Airports & major stations', '70 per capita'],
      ['6', 'Offices / Day schools / Factories', '45 per capita'],
      ['7', 'Cinema / Concert halls / Theatre', '15 per capita'],
    ],
    C_VIOLET, { compact: true },
  );

  y = subTitle(doc, 'Table 4 — Domestic Demand Seasonal Multipliers', y, C_TEAL);
  y = paragraph(doc, 'Seasonal domestic water demand values are calculated using seasonal multipliers that account for variations in water consumption patterns throughout the year.', y);
  y = dataTable(doc, y,
    ['Season', 'Multiplier', 'Rationale'],
    [
      ['Summer',       '1.10', 'Higher consumption due to heat and irrigation needs'],
      ['Monsoon',      '0.95', 'Reduced consumption due to cooler temperatures and outdoor rainfall'],
      ['Post-Monsoon', '1.00', 'Baseline reference season'],
      ['Winter',       '0.90', 'Lower consumption in cold months; reduced bathing frequency'],
    ],
    C_TEAL, { compact: true },
  );

  y = subTitle(doc, 'Table 5 — Floating Population Seasonal Multipliers', y, [6, 120, 155]);
  y = paragraph(doc, 'Seasonal floating water demand values are calculated using floating population seasonal multipliers that reflect variations in temporary population due to tourism, migration, and seasonal work patterns.', y);
  y = dataTable(doc, y,
    ['Season', 'Multiplier', 'Rationale'],
    [
      ['Summer',       '1.15', 'Peak tourism; higher temporary population'],
      ['Monsoon',      '1.25', 'Religious festivals and pilgrimage seasons in many river-basin areas'],
      ['Post-Monsoon', '1.10', 'Moderate seasonal activity; harvest-related migration'],
      ['Winter',       '0.85', 'Lower tourism; reduced seasonal workers'],
    ],
    [6, 120, 155], { compact: true },
  );

  y = subTitle(doc, '3.3  Water Supply', y, C_VIOLET);
  y = paragraph(doc, 'Water supply is analysed against computed demand to derive annual surplus/deficit (gap) and identify likely planning stress periods.', y);

  y = subTitle(doc, '3.4  Sewage', y, C_VIOLET);
  y = paragraph(doc, 'Sewage generation is estimated using water-supply and domestic-flow pathways, with peak-flow methods such as CPHEEO, Harmon, and Babbitt used for design-level interpretation.', y);

  // ── 4. Selection Summary ───────────────────────────────────────────────────
  y = nextPageIfNeeded(doc, y, 50);
  y = sectionTitle(doc, '4. Selection Summary', y, tocEntries, C_BLUE);
  y = paragraph(doc, 'This section documents the exact study-area selection used for all calculations. It helps users validate that outputs are being interpreted for the intended geography and administrative context.', y);
  y = dataTable(doc, y, ['Field', 'Value'], locationRows(input.confirmedLocation), C_BLUE, { emphasizeFirstCol: true });

  // ── 5. Population Forecast ─────────────────────────────────────────────────
  y = nextPageIfNeeded(doc, y, 50);
  y = sectionTitle(doc, '5. Population Forecast', y, tocEntries, C_GREEN);
  y = paragraph(doc, 'Population forecasting is the foundational layer for this DSS. All downstream modules — water demand, water supply gap analysis, and sewage generation — are directly scaled from projected population values.', y);
  y = paragraph(doc, 'Population forecasting in this study has been carried out using multiple methods such as Arithmetic Growth, Geometric Growth, Exponential Models, Demographic, and the Cohort Component Method. Each method accounts for vital statistics like birth, death, emigration, and immigration rates. For example, the Arithmetic Growth method uses historical population data and effective growth rates to estimate future populations, while the Cohort Component Method considers age and sex cohorts for more granular forecasts.', y);
  y = paragraph(doc, 'To enhance the accuracy and demographic resolution of population forecasting, the official dataset titled "Population Projections for India and States: 2011–2036" published by the National Commission on Population, Ministry of Health & Family Welfare (2019) was utilised. This cohort-based projection dataset, originally available at the state and national levels, was systematically downscaled to the village level using demographic normalisation techniques.', y);

  y = subTitle(doc, '5.1  Selected Forecasting Parameters', y, C_GREEN);
  y = dataTable(doc, y,
    ['Item', 'Value'],
    [
      ['Selected Method', input.selectedPopMethod ?? '-'],
      ['Population (2025)', input.population2025 != null ? input.population2025.toLocaleString() : '-'],
      ['Forecast Years', input.populationForecast ? String(Object.keys(input.populationForecast).length) : '0'],
    ],
    C_GREEN, { emphasizeFirstCol: true },
  );

  const populationChart =
    input.populationReportData?.combinedChartData && Object.keys(input.populationReportData.combinedChartData).length
      ? buildPopulationChart(input.populationReportData.combinedChartData)
      : null;
  y = addChartFigure(doc, y, 'Figure 2: Population Forecast Comparison — All Methods', populationChart, C_GREEN);

  if (input.populationReportData?.mergedTableData) {
    const models = Object.keys(input.populationReportData.mergedTableData);
    const years  = Array.from(new Set(models.flatMap((m) => Object.keys(input.populationReportData?.mergedTableData?.[m] ?? {}).map(Number)))).sort((a, b) => a - b);
    y = nextPageIfNeeded(doc, y, 40);
    y = subTitle(doc, '5.2  Population Projections by Year & Method', y, C_GREEN);
    y = paragraph(doc, `The table below shows population projections using ${models.length} forecasting method(s): ${models.join(', ')}. These projections span from ${years[0] ?? '-'} to ${years[years.length - 1] ?? '-'}.`, y);
    y = dataTable(doc, y,
      ['Year', ...models],
      years.map((yr) => [String(yr), ...models.map((m) => Number(input.populationReportData?.mergedTableData?.[m]?.[yr] ?? 0).toLocaleString())]),
      C_GREEN,
    );
    y = paragraph(doc, `For subsequent analysis and calculations, the ${input.selectedPopMethod ?? 'selected'} method has been adopted as the primary population forecasting approach. This method's projections are used for water demand estimation and sewage generation calculations throughout this report.`, y);
  }

  // ── 6. Cohort Table ────────────────────────────────────────────────────────
  if (input.populationReportData?.cohortEntries?.length) {
    const latest = [...input.populationReportData.cohortEntries].sort((a, b) => b.year - a.year)[0];
    const rows   = Object.keys(latest.data ?? {})
      .filter((g) => g !== 'total').slice(0, 20)
      .map((g) => [
        g,
        Number(latest.data[g]?.male ?? 0).toLocaleString(),
        Number(latest.data[g]?.female ?? 0).toLocaleString(),
        Number(latest.data[g]?.total ?? 0).toLocaleString(),
      ]);
    y = nextPageIfNeeded(doc, y, 50);
    y = sectionTitle(doc, `6. Cohort Analysis (${latest.year})`, y, tocEntries, C_TEAL);
    y = paragraph(doc, 'Cohort analysis shows age-sex composition, which improves planning quality for demand-sensitive infrastructure and long-term service design.', y);
    const cohortChart = buildCohortChart(latest.data ?? {});
    y = addChartFigure(doc, y, `Figure 3: Cohort Distribution (${latest.year})`, cohortChart, C_TEAL);
    y = paragraph(doc, 'The cohort graph highlights demographic balance across age groups. High younger cohorts often indicate increasing future service load.', y);
    y = dataTable(doc, y, ['Age Group', 'Male', 'Female', 'Total'], rows, C_TEAL, { compact: true, emphasizeFirstCol: true });
  }

  // ── 7. Water Demand Results ────────────────────────────────────────────────
  if (input.waterDemandReportData) {
    const wd = input.waterDemandReportData;
    const ffMethod = wd.selectedFfMethod || Object.keys(wd.results.firefighting ?? {})[0] || '';
    y = nextPageIfNeeded(doc, y, 50);
    y = sectionTitle(doc, '7. Water Demand Analysis', y, tocEntries, [5, 130, 165]);
    y = paragraph(doc, 'Water demand is estimated based on various contributing factors including domestic, floating, commercial, institutional, and firefighting demands as per CPHEEO guidelines. Water demand is decomposed into its constituent components to clarify which driver contributes most to total demand growth, and to align augmentation plans before deficits become critical.', y);

    y = subTitle(doc, '7.1  Domestic Seasonal Demand', y, [5, 130, 165]);
    y = paragraph(doc, 'Seasonal domestic water demand values are calculated using seasonal multipliers — Summer: 1.1, Monsoon: 0.95, Post-Monsoon: 1.0, Winter: 0.9. These multipliers account for variations in water consumption patterns throughout the year.', y);
    y = dataTable(doc, y,
      ['Season', 'Multiplier', 'Impact on Demand'],
      [
        ['Summer',       '1.10', 'Approx. +10% above annual base demand'],
        ['Monsoon',      '0.95', 'Approx. −5% below annual base demand'],
        ['Post-Monsoon', '1.00', 'Baseline — equal to annual average'],
        ['Winter',       '0.90', 'Approx. −10% below annual base demand'],
      ],
      [5, 130, 165], { compact: true },
    );

    y = subTitle(doc, '7.2  Floating Population Seasonal Demand', y, [5, 130, 165]);
    y = paragraph(doc, 'Seasonal floating water demand values are calculated using floating population seasonal multipliers — Summer: 1.15, Monsoon: 1.25, Post-Monsoon: 1.1, Winter: 0.85. These multipliers reflect variations in temporary population due to tourism, migration, and seasonal work patterns, directly impacting sewage generation volumes.', y);
    y = dataTable(doc, y,
      ['Season', 'Multiplier', 'Impact on Demand'],
      [
        ['Summer',       '1.15', 'Approx. +15% above base — peak tourism'],
        ['Monsoon',      '1.25', 'Approx. +25% above base — festivals & pilgrimage'],
        ['Post-Monsoon', '1.10', 'Approx. +10% above base — harvest migration'],
        ['Winter',       '0.85', 'Approx. −15% below base — off-peak season'],
      ],
      [5, 130, 165], { compact: true },
    );

    y = subTitle(doc, '7.3  Annual Demand Summary', y, [5, 130, 165]);
    y = paragraph(doc, 'The table below presents total computed water demand by year, disaggregated by component. Use this to identify years where total demand accelerates and plan supply augmentation accordingly.', y);
    y = dataTable(doc, y,
      ['Year', 'Population', 'Domestic (MLD)', 'Floating (MLD)', 'Institutional (MLD)', 'Firefighting (MLD)', 'Total (MLD)'],
      wd.years.map((year) => {
        const pop  = Number(wd.forecast?.[year] ?? 0).toLocaleString();
        const dom  = wd.results.domestic?.base_demand?.[year];
        const flo  = wd.results.floating?.base_demand?.[year];
        const inst = wd.results.institutional?.[year];
        const ffi  = ffMethod ? wd.results.firefighting?.[ffMethod]?.[year] : null;
        const total = [dom, flo, inst, ffi].filter((v) => v != null).reduce((s: number, v: any) => s + Number(v), 0);
        return [
          year, pop,
          dom  != null ? Number(dom).toFixed(3)  : '-',
          flo  != null ? Number(flo).toFixed(3)  : '-',
          inst != null ? Number(inst).toFixed(3) : '-',
          ffi  != null ? Number(ffi).toFixed(3)  : '-',
          total > 0    ? total.toFixed(3)         : '-',
        ];
      }),
      [5, 130, 165],
    );
  }

  // ── 8. Water Supply Results ────────────────────────────────────────────────
  if (input.waterSupplyReportData) {
    const ws = input.waterSupplyReportData;
    y = nextPageIfNeeded(doc, y, 50);
    y = sectionTitle(doc, '8. Water Supply Analysis', y, tocEntries, C_VIOLET);
    y = paragraph(doc, 'Water supply analysis aligns with the demand forecasts and is based on either modelled or user-provided data. The water supply values serve as a crucial input for evaluating adequacy and potential deficits in infrastructure. Where data is available, historical supply records are compared with estimated future demands, allowing planners to assess whether current supply infrastructure meets future needs or if upgrades are warranted.', y);
    y = paragraph(doc, 'Integration with GIS and demographic modules ensures spatial consistency in water supply planning, strengthening the foundation for sewage and wastewater projections.', y);

    y = subTitle(doc, '8.1  Water Supply Details', y, C_VIOLET);
    const wsTotalMLD = ws.result?.total_supply ?? input.waterSupplyTotal ?? 0;
    y = paragraph(doc, `The estimated total water supply is: ${wsTotalMLD.toFixed(2)} MLD`, y);
    y = dataTable(doc, y,
      ['Source / Input', 'Value'],
      [
        ['Surface Water (MLD)',          ws.inputs.surfaceWater  || '0'],
        ['Groundwater Direct (MLD)',      ws.inputs.directGW     || '0'],
        ['No. of Tube Wells',            ws.inputs.numTubewells  || '0'],
        ['Discharge Rate (lt/hr)',        ws.inputs.dischargeRate || '0'],
        ['Operating Hours',              ws.inputs.operatingHours || '0'],
        ['Alternate Direct (MLD)',        ws.inputs.directAlt    || '0'],
        ['Computed Groundwater (MLD)',    ws.computed.gwComputed  != null ? ws.computed.gwComputed.toFixed(3)  : '-'],
        ['Computed Alternate (MLD)',      ws.computed.altComputed != null ? ws.computed.altComputed.toFixed(3) : '-'],
        ['Total Supply (MLD)',            ws.result ? ws.result.total_supply.toFixed(3) : '-'],
      ],
      C_VIOLET, { emphasizeFirstCol: true },
    );

    if (ws.gapRows?.length) {
      y = nextPageIfNeeded(doc, y, 40);
      y = subTitle(doc, '8.2  Supply vs. Demand Gap Analysis', y, C_VIOLET);
      y = paragraph(doc, 'Gap analysis compares total supply with annual water demand. A positive gap indicates surplus capacity; a negative gap indicates a deficit requiring supply augmentation or demand management measures.', y);
      y = dataTable(doc, y,
        ['Year', 'Supply (MLD)', 'Demand (MLD)', 'Gap (MLD)'],
        ws.gapRows.map((r) => [
          String(r.year),
          r.supply.toFixed(3),
          r.demand.toFixed(3),
          `${r.gap >= 0 ? '+' : ''}${r.gap.toFixed(3)}`,
        ]),
        C_VIOLET,
      );
    }
  }

  // ── 9. Sewage Results ─────────────────────────────────────────────────────
  if (input.sewageReportData) {
    const sg = input.sewageReportData;
    y = nextPageIfNeeded(doc, y, 50);
    y = sectionTitle(doc, '9. Sewage Generation Analysis', y, tocEntries, C_ORANGE);
    y = paragraph(doc, 'Sewage generation estimation is carried out using two approaches: (a) Sector-based estimation and (b) Water supply-based estimation. The sector-based approach estimates wastewater as a fixed percentage of sectoral water demands, such as 80% of domestic water demand as per CPHEEO standards. The water supply-based approach uses the total water supply figure and applies a wastewater generation factor to calculate total sewage output.', y);
    y = paragraph(doc, 'Peak sewage flow is computed using recognised methods like CPHEEO\'s formula, Harmon\'s, and Babbitt\'s formula, incorporating appropriate peak factors relative to projected population size. These calculations ensure realistic design flows for downstream treatment infrastructure, including STPs and drainage systems (CPHEEO, 2024).', y);

    y = subTitle(doc, '9.1  Analysis Mode & Input Parameters', y, C_ORANGE);
    y = dataTable(doc, y,
      ['Item', 'Value'],
      [
        ['Analysis Mode',                     sg.domesticMode === 'modeled' ? 'Population-based Modelling' : 'Manual Input'],
        ['Water Supply Input (MLD)',          sg.waterSupplyInput || '-'],
        ['Raw Sewage Coefficient (LPCD)',     sg.rawCoeff != null ? sg.rawCoeff.toFixed(2) : '-'],
        ['Treatment Method',                  sg.treatmentMethod  || '-'],
        ['Treatment Capacity',                sg.treatmentCapacity || '-'],
      ],
      C_ORANGE, { emphasizeFirstCol: true, compact: true },
    );

    if (sg.waterSupplyResult != null) {
      y = subTitle(doc, '9.2  Water Supply Method', y, C_ORANGE);
      y = paragraph(doc, `Sewage Calculation Method: Water Supply Based. Total Water Supply: ${sg.waterSupplyInput || '-'} MLD. Sewage Generation (80% of supply): ${sg.waterSupplyResult.toFixed(3)} MLD.`, y);
    }

    // Drain information table — sourced from confirmedLocation if drain mode
    if (input.confirmedLocation?.mode === 'drain' && input.confirmedLocation.drain?.drains?.length) {
      const drainList = input.confirmedLocation.drain.drains;
      y = subTitle(doc, '9.3  Drain Information', y, C_ORANGE);
      y = paragraph(doc, `Number of Drains Tapped: ${drainList.length}. River: ${input.confirmedLocation.drain.river?.name ?? '-'}. Stretch: ${input.confirmedLocation.drain.stretch?.name ?? '-'}.`, y);
      y = dataTable(doc, y,
        ['Drain ID', 'Drain Name'],
        drainList.map((d) => [String(d.id), String(d.name)]),
        C_ORANGE, { compact: true },
      );
    }

    if (sg.stormResult?.storm_water_runoff != null) {
      y = subTitle(doc, '9.4  Storm Water Runoff Analysis', y, C_ORANGE);
      y = paragraph(doc, 'Storm water runoff analysis has been conducted based on shape detection, land use characteristics, and rainfall intensity parameters.', y);
      y = dataTable(doc, y,
        ['Parameter', 'Value'],
        [
          ['Selected Land Use Type',  sg.stormInputs.landUseType || '-'],
          ['Duration Time (min)',     sg.stormInputs.duration || '-'],
          ['Rainfall Intensity (mm/hr)', sg.stormInputs.rainfall || '-'],
          ['Storm Water Runoff Result',  `${sg.stormResult.storm_water_runoff} ${sg.stormResult.unit ?? 'MLD'}`],
        ],
        C_ORANGE, { emphasizeFirstCol: true, compact: true },
      );
      y = paragraph(doc, 'This storm water runoff value represents the expected surface water flow during the specified rainfall event and should be considered for drainage infrastructure planning.', y);
    }

    if (sg.peakRows?.length) {
      const show = new Set(sg.peakSelectedMethods);
      const head: Row = ['Year', 'Population', 'Avg Flow (MLD)'];
      if (show.has('cpheeo'))  head.push('CPHEEO (MLD)');
      if (show.has('harmon'))  head.push('Harmon (MLD)');
      if (show.has('babbitt')) head.push('Babbitt (MLD)');
      y = nextPageIfNeeded(doc, y, 40);
      y = subTitle(doc, '9.5  Peak Flow Calculation Results', y, C_ORANGE);
      y = paragraph(doc, `Peak Flow Source: ${sg.domesticMode?.toUpperCase() ?? 'MODELLED'}. Selected Methods: ${Array.from(show).join(', ').toUpperCase()}. Peak-flow calculations ensure realistic design flows for downstream sewer and treatment infrastructure.`, y);
      y = dataTable(doc, y,
        head,
        sg.peakRows.map((r: any) => {
          const out: Row = [String(r.year), Number(r.population ?? 0).toLocaleString(), Number(r.avg_sewage_flow ?? r.avg ?? 0).toFixed(3)];
          if (show.has('cpheeo'))  out.push(r.cpheeo  != null ? Number(r.cpheeo).toFixed(3)  : '-');
          if (show.has('harmon'))  out.push(r.harmon   != null ? Number(r.harmon).toFixed(3)  : '-');
          if (show.has('babbitt')) out.push(r.babbitt  != null ? Number(r.babbitt).toFixed(3) : '-');
          return out;
        }),
        C_ORANGE,
      );
    }

    if (sg.rawCoeff != null) {
      y = subTitle(doc, '9.6  Raw Sewage Characteristics', y, C_ORANGE);
      y = dataTable(doc, y,
        ['Parameter', 'Value'],
        [
          ['Base Coefficient', `${sg.rawCoeff.toFixed(2)} LPCD`],
          ['Water Supply Input (MLD)', sg.waterSupplyInput || '-'],
        ],
        C_ORANGE, { emphasizeFirstCol: true, compact: true },
      );
    }
  }

  // ── 10. References ────────────────────────────────────────────────────────
  y = nextPageIfNeeded(doc, y, 40);
  y = sectionTitle(doc, '10. References', y, tocEntries, C_MUTED);
  const refs = [
    '1. CPHEEO Manual on Water Supply and Treatment.',
    '2. CPHEEO Manual on Sewerage and Sewage Treatment Systems.',
    '3. Census of India 2011.',
    '4. National Commission on Population (2019), Population Projections for India and States 2011–2036.',
    '5. CPCB Guidance and DSS module outputs / API computations from SCA Platform.',
  ];
  refs.forEach((ref) => { y = paragraph(doc, ref, y); });

  // ── 11. Summary Table ─────────────────────────────────────────────────────
  const forecastYears = input.populationForecast ? Object.keys(input.populationForecast).map(Number).sort((a, b) => a - b) : [];
  const startYear = forecastYears.length ? String(forecastYears[0]) : '-';
  const endYear   = forecastYears.length ? String(forecastYears[forecastYears.length - 1]) : '-';
  const wdYears   = input.waterDemandReportData?.years ?? [];
  const wsGap     = input.waterSupplyReportData?.gapRows ?? [];
  const lastGap   = wsGap.length ? wsGap[wsGap.length - 1] : null;

  y = nextPageIfNeeded(doc, y, 80);
  y = sectionTitle(doc, '11. Summary Table', y, tocEntries, C_BLUE);
  y = paragraph(doc, 'Consolidated key outcomes from all modules — a quick planning snapshot for technical and administrative review.', y);
  y = dataTable(doc, y,
    ['S.No.', 'Parameter', 'Details'],
    [
      ['1', 'Forecast Horizon',                `${startYear} – ${endYear}`],
      ['2', 'Selected Population Method',      input.selectedPopMethod ?? '-'],
      ['3', 'Water Demand Years Analysed',     wdYears.length ? `${wdYears[0]} – ${wdYears[wdYears.length - 1]}` : '-'],
      ['4', 'Total Supply (MLD)',              input.waterSupplyTotal != null ? input.waterSupplyTotal.toFixed(3) : '-'],
      ['5', 'Latest Water Gap Status',         lastGap ? `${lastGap.gap >= 0 ? 'Surplus' : 'Deficit'} (${lastGap.gap >= 0 ? '+' : ''}${lastGap.gap.toFixed(3)} MLD)` : '-'],
      ['6', 'Estimated Sewage Volume (MLD)',   totalSewageVolume.toFixed(3)],
      ['7', 'Peak Flow Methods Selected',      String(input.sewageReportData?.peakSelectedMethods?.length ?? 0)],
    ],
    C_BLUE, { emphasizeFirstCol: false },
  );

  // ── 12. Conclusion ─────────────────────────────────────────────────────────
  y = nextPageIfNeeded(doc, y, 50);
  y = sectionTitle(doc, '12. Conclusion', y, tocEntries, C_NAVY);
  y = paragraph(doc, 'This DSS workflow links demographic growth, sectoral water demand, source-side supply, and sewage generation into one integrated planning chain. The outputs should be read as decision-support estimates to prioritise interventions, identify likely deficits, and phase infrastructure upgrades.', y);
  y = paragraph(doc, 'Recommended use: validate location selection first, review forecast assumptions, confirm demand components, evaluate supply-gap trends, and then apply peak-flow and treatment checks for design-stage planning.', y);

  // ── Fill in TOC page ───────────────────────────────────────────────────────
  doc.setPage(tocPageNum);
  drawTocPage(doc, tocEntries, pageWidth);

  // ── Add PDF bookmarks (outline) ────────────────────────────────────────────
  try {
    tocEntries.forEach((entry) => {
      (doc as any).outline?.add(null, entry.title, { pageNumber: entry.page });
    });
  } catch { /* outline not supported in this version */ }

  // ── Apply footers to all content pages (no top header band) ───────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    drawRunningFooter(doc, pageWidth, pageHeight, i, totalPages);
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  doc.save(`basic2_report_${stamp}.pdf`);
}
