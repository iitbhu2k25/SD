'use client';

import { useState } from 'react';
import { useVarunaSimStore } from '../shared/store/varunaSim.store';
import { deleteScenario, downloadReportPdf, getScenario, listScenarios } from '../shared/services/varunaSim.service';
import type { SimulationRow } from '../shared/types/varunaSim.types';
import { banner, destructiveButton, itemCard, primaryButton, secondaryButton, sectionCard, sectionTitle, smallLabel } from '../shared/ui/styles';

function rowsToCsv(rows: SimulationRow[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => JSON.stringify(row[h] ?? '')).join(','));
  }
  return lines.join('\n');
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResultManagerTab() {
  const { scenarios, setScenarios } = useVarunaSimStore(); // setActiveScenarioId unused — chatbot disabled for now
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const refresh = () => listScenarios().then((res) => setScenarios(res.scenarios)).catch(() => {});

  const handleDownloadCsv = async (id: number, name: string) => {
    setBusyId(id);
    try {
      const full = await getScenario(id);
      downloadText(`varuna_${name.replace(/\s+/g, '_')}.csv`, rowsToCsv(full.rows), 'text/csv');
    } finally {
      setBusyId(null);
    }
  };

  const handleGenerateReport = async (id: number, name: string) => {
    setBusyId(id);
    setReportError(null);
    try {
      await downloadReportPdf(id, name);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to generate report.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setBusyId(id);
    try {
      await deleteScenario(id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  // chatbot disabled for now
  // const handleAskAssistant = (id: number) => {
  //   setActiveScenarioId(id);
  // };

  if (!scenarios.length) {
    return (
      <div className={`${sectionCard} p-4 text-sm text-slate-500`}>No saved scenarios yet.</div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`${sectionCard} p-4 sm:p-5`}>
        <h3 className={`${sectionTitle} mb-3`}>Saved scenarios</h3>
        {reportError && <p className={`${banner.error} mb-3`}>{reportError}</p>}
        <div className="flex flex-col gap-2.5">
          {scenarios.map((s) => (
            <div key={s.id} className={`${itemCard} flex flex-wrap items-center justify-between gap-3`}>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {s.name} <span className="font-normal text-slate-500">- {new Date(s.created_at).toLocaleString()}</span>
                </p>
                <p className={`${smallLabel} mt-1 normal-case tracking-normal`}>
                  Strategies: {s.strategies.length ? s.strategies.join(', ') : 'Baseline'} | Treatment %: {s.treatment_pct.toFixed(1)}% | Untreated: {s.untreated.toFixed(1)} MLD
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryButton} disabled={busyId === s.id} onClick={() => handleDownloadCsv(s.id, s.name)}>
                  Download CSV
                </button>
                <button type="button" className={primaryButton} disabled={busyId === s.id} onClick={() => handleGenerateReport(s.id, s.name)}>
                  {busyId === s.id ? 'Generating...' : 'Generate Report'}
                </button>
                {/* chatbot disabled for now */}
                {/* <button type="button" className={secondaryButton} onClick={() => handleAskAssistant(s.id)}>
                  Ask Assistant
                </button> */}
                <button type="button" className={destructiveButton} disabled={busyId === s.id} onClick={() => handleDelete(s.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
