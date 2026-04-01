'use client';

import { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { useBasicStore } from '../shared/store/basic.store';
import { downloadBasic2Report } from '../shared/utils/basic2Report';

type BrowserReportPayload = {
  confirmedLocation: any;
  selectedPopMethod: string | null;
  populationForecast: Record<number, number> | null;
  population2025: number | null;
  waterDemandTotals: Record<number, number> | null;
  waterSupplyTotal: number | null;
  populationReportData: any | null;
  waterDemandReportData: any | null;
  waterSupplyReportData: any | null;
  sewageReportData: any | null;
  thematicMapData: any | null;
  generatedAt: string;
};

type ReportHostWindow = Window & {
  __basicReportLiveData?: Record<string, BrowserReportPayload>;
};

export default function Basic2ReportDownload() {
  const {
    confirmedLocation,
    selectedPopMethod,
    populationForecast,
    population2025,
    waterDemandTotals,
    waterSupplyTotal,
    populationReportData,
    waterDemandReportData,
    waterSupplyReportData,
    sewageReportData,
    thematicMapData,
  } = useBasicStore();

  const [pdfLoading, setPdfLoading] = useState(false);
  const [browserLoading, setBrowserLoading] = useState(false);

  const disabled = !confirmedLocation;

  const handleDownloadPdf = async () => {
    if (!confirmedLocation) return;
    setPdfLoading(true);
    try {
      await downloadBasic2Report({
        confirmedLocation,
        selectedPopMethod,
        populationForecast,
        population2025,
        waterDemandTotals,
        waterSupplyTotal,
        populationReportData,
        waterDemandReportData,
        waterSupplyReportData,
        sewageReportData,
      });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleViewInBrowser = () => {
    if (!confirmedLocation) return;
    setBrowserLoading(true);
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const datetime = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

      const reportData: BrowserReportPayload = {
        confirmedLocation,
        selectedPopMethod,
        populationForecast,
        population2025,
        waterDemandTotals,
        waterSupplyTotal,
        populationReportData,
        waterDemandReportData,
        waterSupplyReportData,
        sewageReportData,
        thematicMapData,
        generatedAt: now.toISOString(),
      };

      const reportWindowHost = window as ReportHostWindow;
      reportWindowHost.__basicReportLiveData ??= {};
      reportWindowHost.__basicReportLiveData[datetime] = reportData;
      window.open(`/dss/stp/basic/report/${datetime}`, '_blank');
    } finally {
      setBrowserLoading(false);
    }
  };

  const btnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '8px 14px',
    borderRadius: 8,
    border: '1.5px solid',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity 0.15s',
    opacity: disabled ? 0.6 : 1,
  };

  return (
    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      {/* PDF download */}
      <button
        type="button"
        onClick={handleDownloadPdf}
        disabled={disabled || pdfLoading}
        title={confirmedLocation ? 'Download professional PDF report' : 'Confirm a location first'}
        style={{
          ...btnBase,
          borderColor: disabled ? '#cbd5e1' : '#1e4ebe',
          background: disabled
            ? '#f8fafc'
            : 'linear-gradient(135deg,#1e4ebe 0%,#2563eb 100%)',
          color: disabled ? '#94a3b8' : '#ffffff',
          boxShadow: disabled ? 'none' : '0 2px 8px rgba(30,78,190,0.25)',
          opacity: pdfLoading ? 0.75 : disabled ? 0.6 : 1,
        }}
      >
        <Download size={15} strokeWidth={2.4} />
        {pdfLoading ? 'Generating…' : 'PDF'}
      </button>

      {/* View in browser */}
      <button
        type="button"
        onClick={handleViewInBrowser}
        disabled={disabled || browserLoading}
        title={
          confirmedLocation
            ? 'Open interactive report in a new browser tab'
            : 'Confirm a location first'
        }
        style={{
          ...btnBase,
          borderColor: disabled ? '#cbd5e1' : '#046c4e',
          background: disabled
            ? '#f8fafc'
            : 'linear-gradient(135deg,#046c4e 0%,#059669 100%)',
          color: disabled ? '#94a3b8' : '#ffffff',
          boxShadow: disabled ? 'none' : '0 2px 8px rgba(4,108,78,0.25)',
          opacity: browserLoading ? 0.75 : disabled ? 0.6 : 1,
        }}
      >
        <ExternalLink size={15} strokeWidth={2.4} />
        {browserLoading ? 'Opening…' : 'View in Browser'}
      </button>
    </div>
  );
}
