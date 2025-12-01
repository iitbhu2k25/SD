'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEflowContext } from '@/contexts/surfacewater_assessment/admin/EflowContext';
import { useLocationContext } from '@/contexts/surfacewater_assessment/admin/LocationContext';
import EflowPlot from './EflowPlot';

const getOriginalColumnName = (displayName: string): string => {
  try {
    const mappingJson = sessionStorage.getItem('stress_column_mapping');
    if (mappingJson) {
      const mapping: Record<string, string> = JSON.parse(mappingJson);
      return mapping[displayName] || displayName;
    }
  } catch (e) {
    console.error('Failed to get column mapping:', e);
  }
  return displayName;
};

function getFullscreenElement(): Element | null {
  // @ts-ignore
  return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
}
async function requestElFullscreen(el: HTMLElement) {
  // @ts-ignore
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (req) await req.call(el);
  else throw new Error('Fullscreen API not supported');
}
async function exitDocFullscreen() {
  // @ts-ignore
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (exit) await exit.call(document);
}

export default function Eflow() {
  const { selectionConfirmed, getConfirmedSubdistrictIds } = useLocationContext();
  const {
    loading,
    error,
    items,
    mergedItems,
    hasData,
    hasStressData,
    fetchData,
    lastFetchedSubdistricts,
    stressColumns,
    fetchMethodPng,
  } = useEflowContext();

  const [selectedVillage, setSelectedVillage] = useState<number | null>(null);
  const [villageSearchTerm, setVillageSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [chartKey, setChartKey] = useState(0);

  useEffect(() => {
    if (items.length > 0) {
      if (selectedVillage === null || !items.some((s) => s.vlcode === selectedVillage)) {
        const sorted = [...items].sort((a, b) => a.village.localeCompare(b.village));
        setSelectedVillage(sorted[0]?.vlcode ?? null);
        setChartKey((p) => p + 1);
      }
    } else {
      setSelectedVillage(null);
    }
  }, [items, selectedVillage]);

  const villageOptions = useMemo(() => items.map((s) => ({ value: s.vlcode, label: s.village })), [items]);
  const filteredVillageOptions = useMemo(
    () => villageOptions.filter((opt) => opt.label.toLowerCase().includes(villageSearchTerm.toLowerCase())),
    [villageOptions, villageSearchTerm]
  );

  const currentVillage = useMemo(() => {
    if (!selectedVillage) return null;
    return items.find((s) => s.vlcode === selectedVillage) ?? null;
  }, [items, selectedVillage]);

  const handleFetch = useCallback(() => {
    const ids = getConfirmedSubdistrictIds();
    if (ids.length > 0) fetchData(ids);
  }, [getConfirmedSubdistrictIds, fetchData]);

  type MethodKey = 'FDC-Q95' | 'FDC-Q90' | 'Tennant-10%' | 'Tennant-30%' | 'Tennant-60%' | 'Smakhtin' | 'Tessmann';
  const [selectedMethod, setSelectedMethod] = useState<MethodKey>('FDC-Q95');
  const methodsOrder: MethodKey[] = ['FDC-Q95', 'FDC-Q90', 'Tennant-10%', 'Tennant-30%', 'Tennant-60%', 'Smakhtin', 'Tessmann'];

  const handleDownloadCSV = useCallback(() => {
    if (mergedItems.length === 0) return;
    const eflowHeaders = methodsOrder.map((method) => `${method} (ML)`); // surplus in ML
    const header = ['Village', 'Subdistrict', ...eflowHeaders, ...stressColumns].join(',');
    const rows = mergedItems.map((r) => {
      const eflowVals = methodsOrder.map((k) => {
        const valObj = (r.summary as any)?.[k];
        const ml = valObj?.surplus_ML ?? valObj?.surplus_Mm3 ?? null; // try both if any mismatch
        return ml !== undefined && ml !== null ? String(Number(ml).toFixed(6)) : '';
      });
      const stressVals = stressColumns.map((displayCol) => {
        const orig = getOriginalColumnName(displayCol);
        const val = r.stressData?.[orig];
        return val !== undefined && val !== null ? String(val) : '';
      });
      return [r.village, String(r.subdistrict_code), ...eflowVals, ...stressVals].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'eflow_surplus_data.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [mergedItems, stressColumns, methodsOrder]);

  const handleDownloadPNG = useCallback(
    async (vlcode: number, method: MethodKey) => {
      const rec = items.find((r) => r.vlcode === vlcode);
      if (!rec) return;
      const payload = await fetchMethodPng(vlcode, method);
      if (!payload || !payload.image_base64) return;
      const villageName = rec.village.replace(/[^a-z0-9-_]+/gi, '_');
      const a = document.createElement('a');
      a.href = `data:image/png;base64,${payload.image_base64}`;
      a.download = `eflow_${villageName}_${method}.png`;
      a.click();
    },
    [items, fetchMethodPng]
  );

  // Fullscreen refs
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(ev.target as Node)) {
        setIsDropdownOpen(false);
        setVillageSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!getFullscreenElement());
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler as any);
    document.addEventListener('mozfullscreenchange', handler as any);
    document.addEventListener('MSFullscreenChange', handler as any);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler as any);
      document.removeEventListener('mozfullscreenchange', handler as any);
      document.removeEventListener('MSFullscreenChange', handler as any);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (isFullscreen) await exitDocFullscreen();
      else if (chartWrapRef.current) await requestElFullscreen(chartWrapRef.current);
    } catch (e) {
      console.error('Fullscreen error', e);
    }
  }, [isFullscreen]);

  // Build chart data from backend shape (flows_Lps and threshold_Lps)
  const chartData = useMemo(() => {
    if (!currentVillage) return [];
    const curve = (currentVillage.curves as any)?.[selectedMethod];
    if (!curve) return [];

    const days = curve.days ?? [];
    const flows = curve.flows_Lps ?? curve.flows ?? []; // defensive
    const thresholdVal = (currentVillage.summary as any)?.[selectedMethod]?.threshold_Lps ?? curve.threshold_Lps ?? null;

    return days.map((m: number, i: number) => ({
      month: m,
      flow: Number(flows[i] ?? 0),
      threshold: thresholdVal !== null ? Number(thresholdVal) : null,
    }));
  }, [currentVillage, selectedMethod]);

  const threshold = (currentVillage?.summary as any)?.[selectedMethod]?.threshold_Lps ?? null;
  const villageName = currentVillage?.village ?? 'Unknown Village';

  const fmtML = (v?: number) => (v == null ? '-' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 }));

  const summaryCell = (r: any, key: MethodKey) => {
    const obj = r.summary?.[key];
    if (!obj) return '-';
    // backend uses surplus_ML
    const ml = obj?.surplus_ML ?? obj?.surplus_Mm3 ?? null;
    return ml !== undefined && ml !== null ? Number(ml).toFixed(6) : '-';
  };

  if (!selectionConfirmed) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <button disabled className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-300 px-4 py-2 text-sm font-medium text-white cursor-not-allowed">
          Environmental Flow
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-lg text-gray-600">Loading environmental flows...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3">
          <svg className="h-6 w-6 text-red-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-lg font-medium text-red-800">Error Loading Environmental Flow</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
        <button
          onClick={() => {
            const ids = lastFetchedSubdistricts.length > 0 ? lastFetchedSubdistricts : getConfirmedSubdistrictIds();
            if (ids.length > 0) fetchData(ids);
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <button
          onClick={handleFetch}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Fetch E-flow
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Environmental Flow</h2>
            <p className="text-sm text-gray-600">{items.length} village{items.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleFetch} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Fetch E-flow</button>
            <button onClick={handleDownloadCSV} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm border bg-white">Download CSV</button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Method Comparison (All Villages)</h3>
        </div>

        <div className="overflow-auto max-h-96">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left border-b">
                <th className="px-3 py-2 bg-gray-50">Village</th>
                <th className="px-3 py-2 bg-blue-50">FDC-Q95 (ML)</th>
                <th className="px-3 py-2 bg-blue-50">FDC-Q90 (ML)</th>
                <th className="px-3 py-2 bg-blue-50">Tennant-10% (ML)</th>
                <th className="px-3 py-2 bg-blue-50">Tennant-30% (ML)</th>
                <th className="px-3 py-2 bg-blue-50">Tennant-60% (ML)</th>
                <th className="px-3 py-2 bg-blue-50">Smakhtin (ML)</th>
                <th className="px-3 py-2 bg-blue-50">Tessmann (ML)</th>
                {hasStressData && stressColumns.map((c) => <th key={c} className="px-3 py-2 bg-green-50 text-green-800">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {mergedItems.map((r) => (
                <tr key={r.vlcode} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{r.village}</td>
                  <td className="px-3 py-2">{summaryCell(r, 'FDC-Q95')}</td>
                  <td className="px-3 py-2">{summaryCell(r, 'FDC-Q90')}</td>
                  <td className="px-3 py-2">{summaryCell(r, 'Tennant-10%')}</td>
                  <td className="px-3 py-2">{summaryCell(r, 'Tennant-30%')}</td>
                  <td className="px-3 py-2">{summaryCell(r, 'Tennant-60%')}</td>
                  <td className="px-3 py-2">{summaryCell(r, 'Smakhtin')}</td>
                  <td className="px-3 py-2">{summaryCell(r, 'Tessmann')}</td>
                  {hasStressData && stressColumns.map((displayCol) => {
                    const orig = getOriginalColumnName(displayCol);
                    const val = r.stressData?.[orig];
                    const displayVal = val !== undefined && val !== null ? (typeof val === 'number' ? val.toFixed(4) : String(val)) : '-';
                    return <td key={displayCol} className="px-3 py-2 bg-green-50">{displayVal}</td>;
                  })}
                </tr>
              ))}
              {mergedItems.length === 0 && (
                <tr><td colSpan={8 + stressColumns.length} className="px-3 py-4 text-gray-500 text-center">No data. Click Fetch E-flow.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div ref={chartWrapRef} className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${isFullscreen ? 'w-screen h-screen fixed inset-0 z-50 m-0 rounded-none' : ''}`}>
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-xl font-semibold text-gray-900 mb-5">Flow Curves: {villageName}</h2>
        </div>

        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Village:</label>
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="border rounded-md px-3 py-1.5 text-sm bg-white min-w-[200px] text-left flex items-center justify-between">
                <span className="truncate">{selectedVillage ? villageOptions.find((o)=>o.value===selectedVillage)?.label : 'Select village'}</span>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-md shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
                  <div className="p-2 border-b"><input autoFocus value={villageSearchTerm} onChange={(e)=>setVillageSearchTerm(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" placeholder="Search villages..." /></div>
                  <div className="overflow-y-auto max-h-60">
                    {filteredVillageOptions.length > 0 ? filteredVillageOptions.map((opt) => (
                      <button key={opt.value} onClick={()=>{ setSelectedVillage(opt.value); setIsDropdownOpen(false); setVillageSearchTerm(''); }} className={`w-full text-left px-3 py-2 text-sm ${selectedVillage===opt.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>{opt.label}</button>
                    )) : <div className="px-3 py-2 text-sm text-gray-500 text-center">No villages found</div>}
                  </div>
                </div>
              )}
            </div>

            <label className="text-sm text-gray-700 ml-2">Method:</label>
            <select className="border rounded-md px-2 py-1 text-sm" value={selectedMethod} onChange={(e)=>setSelectedMethod(e.target.value as MethodKey)}>
              {methodsOrder.map((m)=> <option key={m} value={m}>{m}</option>)}
            </select>

            <button onClick={toggleFullscreen} className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border ${isFullscreen ? 'bg-purple-600 text-white' : 'bg-white'}`}>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</button>

            {currentVillage && <button onClick={()=>selectedVillage && handleDownloadPNG(selectedVillage, selectedMethod)} className="ml-2 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border bg-white">Download PNG</button>}
          </div>
        </div>

        <div className={`w-full relative ${isFullscreen ? 'h-[calc(100vh-140px)]' : 'h-96'}`}>
          {chartData.length > 0 ? (
            <EflowPlot key={chartKey} data={chartData} methodLabel={selectedMethod} threshold={threshold} villageName={villageName} height={isFullscreen? Math.max(window.innerHeight-160, 400) : 420} width="100%" />
          ) : <div className="flex items-center justify-center h-full text-gray-500">No data available for selected village</div>}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div><strong>Selected method:</strong> {selectedMethod}</div>
          <div><strong>Surplus (backend):</strong> {currentVillage?.summary?.[selectedMethod] ? `${fmtML((currentVillage.summary as any)[selectedMethod].surplus_ML)} ML` : '-'}</div>
        </div>
      </div>
    </div>
  );
}
