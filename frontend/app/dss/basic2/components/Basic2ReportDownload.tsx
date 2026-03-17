'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { useBasicStore } from '../shared/store/basic.store';
import { downloadBasic2Report } from '../shared/utils/basic2Report';

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
  } = useBasicStore();

  const [loading, setLoading] = useState(false);

  const disabled = !confirmedLocation || loading;

  const handleDownloadPdf = async () => {
    if (!confirmedLocation) return;
    setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownloadPdf}
      disabled={disabled}
      title={confirmedLocation ? 'Download professional PDF report' : 'Confirm a location first'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '8px 16px',
        borderRadius: 8,
        border: '1.5px solid',
        borderColor: disabled ? '#cbd5e1' : '#1e4ebe',
        background: disabled ? '#f8fafc' : 'linear-gradient(135deg,#1e4ebe 0%,#2563eb 100%)',
        color: disabled ? '#94a3b8' : '#ffffff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        boxShadow: disabled ? 'none' : '0 2px 8px rgba(30,78,190,0.25)',
        transition: 'opacity 0.15s',
        opacity: loading ? 0.75 : 1,
      }}
    >
      <Download size={15} strokeWidth={2.4} />
      {loading ? 'Generating PDF…' : 'Download Report'}
    </button>
  );
}
